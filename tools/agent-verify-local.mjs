import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const TITLE = 'PRIVACY_AGENT_VERIFY_LOCAL'
const MAX_COMMAND_OUTPUT = 16 * 1024 * 1024
const PROTECTED_BRANCHES = new Set(['main', 'master'])
const BUILD_EXECUTION_SURFACES = Object.freeze([
  'frontend/package.json',
  'frontend/package-lock.json',
  'frontend/vite.config.ts',
])

const DANGEROUS_WHEN_TRUE = Object.freeze([
  'PRIVACY_LORA_ALLOW_RUNPOD',
  'PRIVACY_LORA_ALLOW_TRAINING',
  'PRIVACY_LORA_ALLOW_MODEL_DOWNLOADS',
  'WORKERS_ENABLED',
  'ALLOW_EXTERNAL_REDIS_WORKERS',
  'RENDITION_QUEUE_ENABLED',
  'SCENE_DIRECTION_QUEUE_ENABLED',
  'ACTOR_PIPELINE_QUEUE_ENABLED',
  'IDENTITY_LORA_TRAINING_ENABLED',
  'IDENTITY_LORA_INFERENCE_INJECTION_READY',
  'IDENTITY_LORA_TRAINING_TARGET_AUDIT_APPROVED',
  'IDENTITY_LORA_PAID_TRAINING_AFTER_TARGET_AUDIT',
  'IDENTITY_LORA_REAL_SMOKE_ENABLED',
  'IDENTITY_LORA_PREVIEW_ENABLED',
  'IDENTITY_LORA_PREVIEW_SMOKE_ENABLED',
])

const DANGEROUS_UNLESS_TRUE_WHEN_SET = Object.freeze([
  'IDENTITY_LORA_TRAINER_DRY_RUN_ONLY',
  'IDENTITY_LORA_PREVIEW_DRY_RUN_ONLY',
])

const report = {
  branch: 'UNKNOWN',
  head: 'UNKNOWN',
  git_context: 'NOT_RUN',
  dangerous_environment: 'NOT_RUN',
  build_execution_surface: 'NOT_RUN',
  frontend_build_contract: 'NOT_RUN',
  frontend_build_script: 'NOT_CHECKED',
  frontend_prebuild: 'NOT_CHECKED',
  frontend_postbuild: 'NOT_CHECKED',
  backend_static_syntax: 'NOT_RUN',
  backend_js_checked: 0,
  backend_js_failed: 0,
  frontend_build: 'NOT_RUN',
  frontend_lint: 'NOT_CONFIGURED',
  frontend_typecheck: 'NOT_CONFIGURED',
  git_diff_check: 'NOT_RUN',
}

const diagnostics = []
let gitStatusLines = []
let reason = null
let dangerousEnvironmentFlags = []
let changedBuildExecutionSurfaces = []
let status = 'AGENT_VERIFY_LOCAL_FAIL'

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    maxBuffer: MAX_COMMAND_OUTPUT,
  })

  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    error: result.error || null,
  }
}

function runGit(args, cwd) {
  return run('git', args, cwd)
}

function runFrontendBuild(cwd) {
  if (process.platform === 'win32') {
    return run('cmd.exe', ['/d', '/s', '/c', 'npm run build'], cwd)
  }

  return run('npm', ['run', 'build'], cwd)
}

function commandOutput(result) {
  return [result.stdout, result.stderr, result.error?.message || '']
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n')
}

function addDiagnostic(label, result) {
  const output = commandOutput(result)
  diagnostics.push(output ? `${label}:\n${output}` : label)
}

function splitNullDelimited(value) {
  return value.split('\0').filter(Boolean)
}

function normalizeBoolean(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isDangerouslyTrue(value) {
  return normalizeBoolean(value) === 'true'
}

function findDangerousEnvironmentFlags() {
  const enabledFlags = DANGEROUS_WHEN_TRUE.filter((name) => isDangerouslyTrue(process.env[name]))
  const disabledSafetyFlags = DANGEROUS_UNLESS_TRUE_WHEN_SET.filter(
    (name) => process.env[name] !== undefined && normalizeBoolean(process.env[name]) !== 'true',
  )

  return [...enabledFlags, ...disabledSafetyFlags].sort()
}

function inspectBuildExecutionSurface(repositoryRoot) {
  const changedPaths = []

  for (const surface of BUILD_EXECUTION_SURFACES) {
    const result = runGit(['status', '--short', '--untracked-files=all', '--', surface], repositoryRoot)

    if (!result.ok) return { ok: false, changedPaths, result }
    if (result.stdout.trim()) changedPaths.push(surface)
  }

  return { ok: true, changedPaths, result: null }
}

function inspectFrontendBuildContract(repositoryRoot) {
  try {
    const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, 'frontend', 'package.json'), 'utf8'))
    const scripts = packageJson && typeof packageJson === 'object' && packageJson.scripts && typeof packageJson.scripts === 'object'
      ? packageJson.scripts
      : null
    const buildScript = typeof scripts?.build === 'string' ? scripts.build : null
    const hasPrebuild = scripts !== null && Object.prototype.hasOwnProperty.call(scripts, 'prebuild')
    const hasPostbuild = scripts !== null && Object.prototype.hasOwnProperty.call(scripts, 'postbuild')

    return {
      ok: buildScript === 'vite build' && !hasPrebuild && !hasPostbuild,
      buildScript,
      hasPrebuild,
      hasPostbuild,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      buildScript: null,
      hasPrebuild: false,
      hasPostbuild: false,
      error,
    }
  }
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

function relativeForOutput(root, candidate) {
  return path.relative(root, candidate).split(path.sep).join('/')
}

function printReport() {
  console.log(TITLE)
  console.log('')
  console.log(`branch=${report.branch}`)
  console.log(`head=${report.head}`)
  console.log('')
  console.log(`git_context=${report.git_context}`)
  console.log(`dangerous_environment=${report.dangerous_environment}`)
  console.log(`build_execution_surface=${report.build_execution_surface}`)
  console.log(`frontend_build_contract=${report.frontend_build_contract}`)
  console.log(`frontend_build_script=${report.frontend_build_script}`)
  console.log(`frontend_prebuild=${report.frontend_prebuild}`)
  console.log(`frontend_postbuild=${report.frontend_postbuild}`)
  console.log(`backend_static_syntax=${report.backend_static_syntax}`)
  console.log(`backend_js_checked=${report.backend_js_checked}`)
  console.log(`backend_js_failed=${report.backend_js_failed}`)
  console.log(`frontend_build=${report.frontend_build}`)
  console.log(`frontend_lint=${report.frontend_lint}`)
  console.log(`frontend_typecheck=${report.frontend_typecheck}`)
  console.log(`git_diff_check=${report.git_diff_check}`)
  console.log('')
  console.log('external_operations_in_harness=false')
  console.log('network_isolation=NOT_ENFORCED')
  console.log('runpod_called=false')
  console.log('gpu_started=false')
  console.log('r2_called=false')
  console.log('supabase_called=false')
  console.log('redis_called=false')
  console.log('workers_started=false')
  console.log('financial_operation=false')
  console.log('')
  console.log(`git_status_entries=${gitStatusLines.length}`)
  console.log('git_status_begin')
  for (const line of gitStatusLines) console.log(line)
  console.log('git_status_end')

  if (dangerousEnvironmentFlags.length > 0) {
    console.log(`dangerous_environment_flags=${dangerousEnvironmentFlags.join(',')}`)
  }

  if (changedBuildExecutionSurfaces.length > 0) {
    console.log(`build_execution_surface_changed=${changedBuildExecutionSurfaces.join(',')}`)
  }

  if (reason) console.log(`reason=${reason}`)

  if (diagnostics.length > 0) {
    console.log('diagnostics_begin')
    for (const diagnostic of diagnostics) console.log(diagnostic)
    console.log('diagnostics_end')
  }

  console.log('')
  console.log(`STATUS=${status}`)
}

function finish(exitCode) {
  printReport()
  process.exitCode = exitCode
}

const rootResult = runGit(['rev-parse', '--show-toplevel'], process.cwd())

if (!rootResult.ok) {
  report.git_context = 'FAIL'
  reason = 'repository_root_not_found'
  addDiagnostic('git repository root detection failed', rootResult)
  finish(1)
} else {
  const repositoryRoot = path.resolve(rootResult.stdout.trim())
  const branchResult = runGit(['branch', '--show-current'], repositoryRoot)
  const headResult = runGit(['rev-parse', 'HEAD'], repositoryRoot)
  const initialStatusResult = runGit(['status', '--short'], repositoryRoot)

  if (!branchResult.ok || !headResult.ok || !initialStatusResult.ok) {
    report.git_context = 'FAIL'
    reason = 'git_context_unavailable'
    if (!branchResult.ok) addDiagnostic('git branch detection failed', branchResult)
    if (!headResult.ok) addDiagnostic('git HEAD detection failed', headResult)
    if (!initialStatusResult.ok) addDiagnostic('git status failed', initialStatusResult)
    finish(1)
  } else {
    report.branch = branchResult.stdout.trim() || 'DETACHED'
    report.head = headResult.stdout.trim()
    gitStatusLines = initialStatusResult.stdout.split(/\r?\n/).filter(Boolean)

    if (PROTECTED_BRANCHES.has(report.branch.toLowerCase())) {
      report.git_context = 'BLOCKED'
      reason = 'protected_branch'
      status = 'AGENT_VERIFY_BLOCKED'
      finish(1)
    } else {
      report.git_context = 'PASS'
      dangerousEnvironmentFlags = findDangerousEnvironmentFlags()

      if (dangerousEnvironmentFlags.length > 0) {
        report.dangerous_environment = 'BLOCKED'
        reason = 'dangerous_environment'
        status = 'AGENT_VERIFY_BLOCKED'
        finish(1)
      } else {
        report.dangerous_environment = 'PASS'
        let buildPreflightBlocked = false
        const buildSurfaceResult = inspectBuildExecutionSurface(repositoryRoot)

        if (!buildSurfaceResult.ok) {
          buildPreflightBlocked = true
          report.build_execution_surface = 'BLOCKED'
          reason = 'build_execution_surface_check_failed'
          status = 'AGENT_VERIFY_BLOCKED'
          addDiagnostic('build execution surface check failed', buildSurfaceResult.result)
          finish(1)
        } else if (buildSurfaceResult.changedPaths.length > 0) {
          buildPreflightBlocked = true
          changedBuildExecutionSurfaces = buildSurfaceResult.changedPaths
          report.build_execution_surface = 'BLOCKED'
          reason = 'build_execution_surface_changed'
          status = 'AGENT_VERIFY_BLOCKED'
          finish(1)
        } else {
          report.build_execution_surface = 'PASS'
        }

        if (!buildPreflightBlocked) {
          const buildContract = inspectFrontendBuildContract(repositoryRoot)
          report.frontend_build_script = buildContract.buildScript === 'vite build' ? 'vite build' : 'UNEXPECTED'
          report.frontend_prebuild = buildContract.hasPrebuild ? 'PRESENT' : 'ABSENT'
          report.frontend_postbuild = buildContract.hasPostbuild ? 'PRESENT' : 'ABSENT'

          if (!buildContract.ok) {
            buildPreflightBlocked = true
            report.frontend_build_contract = 'BLOCKED'
            reason = 'frontend_build_contract_changed'
            status = 'AGENT_VERIFY_BLOCKED'
            if (buildContract.error) diagnostics.push(`frontend package contract could not be read: ${buildContract.error.message}`)
            finish(1)
          } else {
            report.frontend_build_contract = 'PASS'
          }
        }

        if (!buildPreflightBlocked) {
        const failures = []

        const backendFilesResult = runGit(
          ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'backend'],
          repositoryRoot,
        )

        if (!backendFilesResult.ok) {
          report.backend_static_syntax = 'FAIL'
          failures.push('backend_static_syntax')
          addDiagnostic('backend file enumeration failed', backendFilesResult)
        } else {
          const backendFiles = splitNullDelimited(backendFilesResult.stdout)
            .filter((file) => file.endsWith('.js'))
            .map((file) => path.resolve(repositoryRoot, file))
            .filter((file) => isPathInside(repositoryRoot, file) && existsSync(file) && lstatSync(file).isFile())
            .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))

          for (const file of backendFiles) {
            const syntaxResult = run(process.execPath, ['--check', file], repositoryRoot)
            report.backend_js_checked += 1

            if (!syntaxResult.ok) {
              report.backend_js_failed += 1
              addDiagnostic(`node --check failed for ${relativeForOutput(repositoryRoot, file)}`, syntaxResult)
            }
          }

          report.backend_static_syntax = report.backend_js_failed === 0 ? 'PASS' : 'FAIL'
          if (report.backend_static_syntax === 'FAIL') failures.push('backend_static_syntax')
        }

        const distIgnoreResult = runGit(['check-ignore', '--quiet', '--', 'frontend/dist'], repositoryRoot)

        if (!distIgnoreResult.ok) {
          report.frontend_build = 'FAIL'
          failures.push('frontend_build')
          addDiagnostic('frontend/dist is not ignored by Git; build was not started', distIgnoreResult)
        } else {
          const frontendBuildResult = runFrontendBuild(path.join(repositoryRoot, 'frontend'))
          report.frontend_build = frontendBuildResult.ok ? 'PASS' : 'FAIL'

          if (!frontendBuildResult.ok) {
            failures.push('frontend_build')
            addDiagnostic('frontend npm run build failed', frontendBuildResult)
          }
        }

        const workingDiffResult = runGit(['diff', '--check'], repositoryRoot)
        const cachedDiffResult = runGit(['diff', '--cached', '--check'], repositoryRoot)
        report.git_diff_check = workingDiffResult.ok && cachedDiffResult.ok ? 'PASS' : 'FAIL'

        if (!workingDiffResult.ok || !cachedDiffResult.ok) {
          failures.push('git_diff_check')
          if (!workingDiffResult.ok) addDiagnostic('git diff --check failed', workingDiffResult)
          if (!cachedDiffResult.ok) addDiagnostic('git diff --cached --check failed', cachedDiffResult)
        }

        const finalStatusResult = runGit(['status', '--short'], repositoryRoot)
        if (finalStatusResult.ok) {
          gitStatusLines = finalStatusResult.stdout.split(/\r?\n/).filter(Boolean)
        } else {
          failures.push('git_status')
          addDiagnostic('final git status failed', finalStatusResult)
        }

        if (failures.length === 0) {
          status = 'AGENT_VERIFY_LOCAL_PASS'
          finish(0)
        } else {
          reason = failures.join(',')
          status = 'AGENT_VERIFY_LOCAL_FAIL'
          finish(1)
        }
        }
      }
    }
  }
}
