import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  FileAudio,
  FileImage,
  FileText,
  FileUp,
  FileVideo2,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  UploadCloud,
  UserCheck,
  XCircle,
} from "lucide-react";
import {
  createPublicMappingCase,
  getActorOnboardingPortal,
  registerActorAuthByInvite,
  submitPublicMappingForReview,
  uploadPublicMappingAsset,
  type ActorOnboardingPortal,
  type PublicIdentityCompletionTask,
} from "@/features/actor-onboarding/api/actorOnboardingApi";
import { parseApiError } from "@/shared/utils/parseApiError";
import { useAuthStore } from "@/shared/stores/useAuthStore";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const PASSWORD_RULES = [
  { label: "8+ caracteres", test: (value: string) => value.length >= 8 },
  { label: "1 letra maiúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "1 letra minúscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "1 número", test: (value: string) => /[0-9]/.test(value) },
  { label: "1 símbolo", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    pending: "Aguardando aceite",
    accepted: "Convite aceito",
    draft: "Em preparação",
    pending_review: "Em análise",
    changes_requested: "Ajustes solicitados",
    changes_in_progress: "Ajustes em andamento",
    approved: "Aprovado",
    rejected: "Ajustes solicitados",
    incomplete: "Incompleto",
    ready_for_review: "Pronto para análise",
    uploaded: "Recebido",
    registered_dry_run: "Simulação",
  };

  return map[String(status || "")] || status || "Não iniciado";
}

function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;

  return (
    <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
      <strong className="block text-rose-50">Não foi possível concluir.</strong>
      <span className="mt-1 block text-rose-100/80">
        {parseApiError(error)}
      </span>
    </div>
  );
}

function InfoCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}

type WorkflowStepState = "complete" | "active" | "pending" | "issue";

function WorkflowStep({
  number,
  title,
  description,
  state,
}: {
  number: number;
  title: string;
  description: string;
  state: WorkflowStepState;
}) {
  const stateClasses: Record<WorkflowStepState, string> = {
    complete: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    active: "border-amber-300/35 bg-amber-300/10 text-amber-100",
    issue: "border-rose-400/30 bg-rose-400/10 text-rose-100",
    pending: "border-white/10 bg-black/25 text-zinc-500",
  };

  return (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-2xl border p-3 ${stateClasses[state]}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-current/20 bg-black/20 text-xs font-black">
        {state === "complete" ? (
          <CheckCircle2 size={16} />
        ) : state === "issue" ? (
          <XCircle size={16} />
        ) : (
          number
        )}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-black text-current">{title}</p>
        <p className="mt-1 text-xs leading-5 opacity-70">{description}</p>
      </div>
    </div>
  );
}

function MaterialIcon({
  mediaType,
  className = "",
}: {
  mediaType?: string | null;
  className?: string;
}) {
  if (mediaType === "image")
    return <FileImage className={className} size={18} />;
  if (mediaType === "video")
    return <FileVideo2 className={className} size={18} />;
  if (mediaType === "audio")
    return <FileAudio className={className} size={18} />;
  return <FileText className={className} size={18} />;
}

function formatFileSize(value?: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "tamanho não informado";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function ActorOnboardingPage() {
  const { inviteToken = "" } = useParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [portal, setPortal] = useState<ActorOnboardingPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [mappingRequirementId, setMappingRequirementId] = useState("");
  const [identityCompletionTaskId, setIdentityCompletionTaskId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replacementAssetId, setReplacementAssetId] = useState("");

  const requirements = portal?.requirements || [];
  const selectedMaterial = useMemo(
    () =>
      requirements.find((item) => item.id === mappingRequirementId) ||
      requirements[0] ||
      null,
    [mappingRequirementId, requirements],
  );

  const checklist = portal?.mappingCase?.mappingChecklist || null;
  const allAssets = portal?.mappingCase?.assets || [];
  const assets = allAssets.filter((asset) => !["archived", "deleted", "quarantined"].includes(String(asset.status || "").toLowerCase()));
  const rejectedAssets = assets.filter((asset) => asset.status === "rejected");
  const replacementAsset = replacementAssetId ? rejectedAssets.find((asset) => asset.id === replacementAssetId) || null : null;
  const inviteAccepted = portal?.invite.status === "accepted";
  const authLinked = Boolean(
    portal?.actor.status &&
    portal.actor.status !== "draft" &&
    portal.actor.status !== "invited",
  );
  const mappingReadyForReview = Boolean(checklist?.isComplete);
  const actorSubmittedForReview = Boolean(
    portal?.mappingCase?.actorSubmittedForReview,
  );
  const mappingReviewStatus = portal?.mappingCase?.reviewStatus || null;
  const mappingApproved =
    portal?.actor.mappingStatus === "approved" ||
    portal?.mappingCase?.status === "approved" ||
    mappingReviewStatus === "approved";
  const supplementalReviewStatus = String(portal?.mappingCase?.supplementalReview?.status || "");
  const supplementalPendingAssets = assets.filter((asset) => asset.status === "pending_review").length;
  const supplementalUnderReview = ["sent_for_admin_review", "in_progress"].includes(supplementalReviewStatus);
  const mappingChangesRequested =
    ["changes_requested", "changes_in_progress"].includes(String(mappingReviewStatus || "")) ||
    portal?.actor.mappingStatus === "rejected" ||
    portal?.mappingCase?.status === "rejected";
  const mappingUnderReview =
    (mappingReviewStatus === "sent_for_review" || actorSubmittedForReview) &&
    !mappingApproved &&
    !mappingChangesRequested;
  const mappingSubmittedForReview = mappingUnderReview || supplementalUnderReview || mappingApproved;
  const canEditMaterials =
    inviteAccepted &&
    Boolean(portal?.mappingCase) &&
    !mappingUnderReview &&
    !supplementalUnderReview &&
    (!mappingApproved || Boolean(portal?.mappingCase?.canAddSupplementalMaterials));
  const canReplaceRejected =
    inviteAccepted &&
    Boolean(portal?.mappingCase) &&
    rejectedAssets.length > 0;
  const canUseUpload = canEditMaterials || Boolean(replacementAsset);
  const checklistGroups = checklist?.groups || [];
  const missingRequiredGroups = checklistGroups.filter(
    (group) => group.required && !group.present,
  );
  const completedRequired = checklist?.completedRequired || 0;
  const totalRequired = checklist?.totalRequired || 0;
  const progressPercent = Math.min(
    100,
    (completedRequired / Math.max(totalRequired, 1)) * 100,
  );
  const identityDataset = portal?.identityDataset || null;
  const identityMaterialsReady = Boolean(identityDataset?.materialsReady);
  const identityImagesCurrent = identityDataset?.validUniqueImages || 0;
  const identityVideosCurrent = identityDataset?.validUniqueVideos || 0;
  const identityImagesMinimum = identityDataset?.minimumImages || 15;
  const identityVideosMinimum = identityDataset?.minimumVideos || 6;
  const identityPendingReview = identityDataset?.pendingReviewAssets || 0;
  const identityPendingImages = identityDataset?.pendingReviewImages || 0;
  const identityPendingVideos = identityDataset?.pendingReviewVideos || 0;
  const identityProjectedImages = Math.min(identityImagesMinimum, identityImagesCurrent + identityPendingImages);
  const identityProjectedVideos = Math.min(identityVideosMinimum, identityVideosCurrent + identityPendingVideos);
  const identityCompletionPlan = identityDataset?.completionPlan || null;
  const identityCompletionTasks = identityCompletionPlan?.tasks || [];
  const selectedCompletionTask = useMemo(
    () => identityCompletionTasks.find((task) => task.id === identityCompletionTaskId) || identityCompletionTasks[0] || null,
    [identityCompletionTaskId, identityCompletionTasks],
  );
  const identityImageProgress = Math.min(100, (identityImagesCurrent / Math.max(identityImagesMinimum, 1)) * 100);
  const identityVideoProgress = Math.min(100, (identityVideosCurrent / Math.max(identityVideosMinimum, 1)) * 100);
  const identityOverallProgress = Math.round((identityImageProgress + identityVideoProgress) / 2);
  const requirementById = useMemo(
    () => new Map(requirements.map((item) => [item.id, item])),
    [requirements],
  );
  const sortedAssets = useMemo(
    () =>
      [...assets].sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      ),
    [assets],
  );
  const selectedUploadTitle = selectedCompletionTask?.title || selectedMaterial?.title || "Material solicitado";
  const selectedUploadGuidance = selectedCompletionTask?.guidance || (selectedMaterial ? selectedMaterial.guidance || selectedMaterial.description : "") || "Siga a orientação informada pelo Admin.";
  const passwordReady = PASSWORD_RULES.every((rule) => rule.test(password));
  const passwordMatches =
    password.length > 0 && password === passwordConfirmation;

  const currentPhase = !inviteAccepted
    ? {
        eyebrow: "Etapa 1 de 4",
        title: "Aceite o convite e crie seu acesso",
        description:
          "Confirme seus dados para liberar sua área de preparação.",
      }
    : !portal?.mappingCase
      ? {
          eyebrow: "Etapa 2 de 4",
          title: "Inicie seu mapeamento",
          description:
            "Abra a coleta para visualizar os materiais solicitados pelo Admin.",
        }
      : mappingApproved && identityMaterialsReady
        ? {
            eyebrow: "Conjunto de identidade completo",
            title: "Materiais prontos para a preparação técnica",
            description:
              "As fotos e os vídeos necessários foram aprovados. O próximo estágio será conduzido pelo Admin.",
          }
        : mappingApproved && supplementalUnderReview
          ? {
              eyebrow: "Complementação em análise",
              title: "Novos materiais em conferência",
              description:
                "O mapeamento geral permanece aprovado. O Admin está analisando somente os materiais complementares.",
            }
          : mappingApproved
            ? {
                eyebrow: "Materiais iniciais analisados",
                title: "Complete sua identidade para vídeos",
                description:
                  "Ainda há materiais específicos para enviar. Use a lista abaixo: cada item explica exatamente o que falta.",
              }
          : mappingUnderReview
            ? {
                eyebrow: "Etapa 4 de 4",
                title: "Mapeamento em análise",
                description:
                  "O Admin está revisando seus materiais. Você será orientado caso algum ajuste seja necessário.",
              }
            : mappingChangesRequested
              ? {
                  eyebrow: "Ajustes solicitados",
                  title: "Faça apenas os ajustes indicados",
                  description:
                    portal?.mappingCase?.rejectionReason ||
                    "O Admin indicou ajustes. Corrija somente o necessário; todo o histórico anterior permanece salvo.",
                }
              : {
                  eyebrow: "Etapa 3 de 4",
                  title: "Complete os materiais solicitados",
                  description:
                    missingRequiredGroups.length > 0
                      ? `Faltam ${missingRequiredGroups.length} categoria(s) obrigatória(s).`
                      : "Todos os itens obrigatórios foram recebidos. Revise e envie para análise.",
                };

  useEffect(() => {
    if (mappingApproved && identityCompletionTasks.length > 0) {
      const activeTask = identityCompletionTasks.find((task) => task.id === identityCompletionTaskId) || identityCompletionTasks[0];
      if (activeTask.id !== identityCompletionTaskId) setIdentityCompletionTaskId(activeTask.id);
      if (activeTask.requirementId !== mappingRequirementId) setMappingRequirementId(activeTask.requirementId);
      return;
    }
    if (requirements[0]?.id && !requirements.some((item) => item.id === mappingRequirementId)) {
      setMappingRequirementId(requirements[0].id);
    }
  }, [identityCompletionTaskId, identityCompletionTasks, mappingApproved, mappingRequirementId, requirements]);

  async function refresh() {
    if (!inviteToken) return;
    setError(null);
    const data = await getActorOnboardingPortal(inviteToken);
    setPortal(data);
    setDisplayName((current) => current || data.actor.displayName || "");
    setEmail(
      (current) => current || data.actor.email || data.invite.email || "",
    );
    setPhone((current) => current || data.actor.phone || "");
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [inviteToken]);

  async function handleRegisterAccess() {
    if (!inviteToken) return;

    if (!displayName.trim()) {
      setError(new Error("Informe seu nome artístico."));
      return;
    }

    if (!email.trim()) {
      setError(new Error("Informe o e-mail do convite."));
      return;
    }

    if (!passwordReady) {
      setError(
        new Error(
          "Crie uma senha com maiúscula, minúscula, número, símbolo e pelo menos 8 caracteres.",
        ),
      );
      return;
    }

    if (!passwordMatches) {
      setError(new Error("A confirmação da senha não confere."));
      return;
    }

    setBusy(true);
    setError(null);
    setMessage("");

    try {
      const result = await registerActorAuthByInvite(inviteToken, {
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });

      setPortal((current) =>
        current
          ? { ...current, actor: result.actor, invite: result.invite }
          : current,
      );
      setPassword("");
      setPasswordConfirmation("");
      setMessage(
        result.message ||
          "Acesso criado. Agora você pode continuar o mapeamento.",
      );

      if (result.token) {
        setAuth(result.token, {
          id: result.user.id,
          name: result.user.name || result.actor.displayName || "Pessoa participante",
          email: result.user.email || result.actor.email || email.trim(),
          role: "atriz",
          credits: result.user.credits ?? 0,
        });
      }

      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateMapping() {
    if (!inviteToken) return;
    setBusy(true);
    setError(null);
    setMessage("");

    try {
      await createPublicMappingCase(inviteToken);
      await refresh();
      setMessage("Mapeamento aberto. Envie os materiais solicitados abaixo.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function prepareReplacement(assetId: string, requirementId: string | null) {
    if (!canReplaceRejected) {
      setError(new Error("Nenhum material devolvido está disponível para substituição."));
      return;
    }
    if (!requirementId || !requirementById.has(requirementId)) {
      setError(new Error("O arquivo devolvido ainda não possui uma categoria ativa válida. Peça ao Admin para classificá-lo antes do reenvio."));
      return;
    }
    setReplacementAssetId(assetId);
    setMappingRequirementId(requirementId);
    setFile(null);
    setError(null);
    document.getElementById("envio-material")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleUploadMaterial() {
    if (!inviteToken || !file || !selectedMaterial) return;

    if (!canUseUpload) {
      setError(
        new Error(
          mappingApproved
            ? "Os materiais complementares estão em análise e não podem ser alterados neste momento."
            : "O mapeamento está em análise e não pode ser alterado neste momento.",
        ),
      );
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setError(new Error("Arquivo maior que 25 MB. Envie um material menor."));
      return;
    }

    setBusy(true);
    setError(null);
    setMessage("");

    try {
      const base64 = await readFileAsDataUrl(file);
      await uploadPublicMappingAsset(inviteToken, {
        mappingRequirementId: selectedMaterial.id,
        replacementAssetId: replacementAssetId || undefined,
        base64,
        contentType: file.type || "application/octet-stream",
        originalFilename: file.name,
        byteSize: file.size,
        metadata: {
          source: "public_actor_onboarding_page",
          ...(selectedCompletionTask && !replacementAssetId ? {
            identityCompletionTaskId: selectedCompletionTask.id,
            identityCompletion: {
              taskId: selectedCompletionTask.id,
              origin: selectedCompletionTask.origin,
              title: selectedCompletionTask.title,
            },
          } : {}),
        },
      });
      const replaced = Boolean(replacementAssetId);
      setFile(null);
      setReplacementAssetId("");
      if (selectedCompletionTask) setIdentityCompletionTaskId("");
      await refresh();
      setMessage(replaced
        ? "Novo arquivo recebido. O material devolvido saiu do conjunto ativo e foi preservado somente para auditoria."
        : "Material adicionado ao mapeamento e armazenado com segurança.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitMappingReview() {
    if (!inviteToken) return;

    if (!mappingApproved && !mappingReadyForReview) {
      setError(
        new Error(
          "Complete todos os materiais obrigatórios antes de enviar para análise.",
        ),
      );
      return;
    }

    if (mappingApproved && supplementalPendingAssets === 0) {
      setError(new Error("Adicione ao menos um novo material antes de enviar a complementação para análise."));
      return;
    }

    if (mappingUnderReview || supplementalUnderReview) {
      setError(new Error("Estes materiais já estão em análise."));
      return;
    }

    setBusy(true);
    setError(null);
    setMessage("");

    try {
      await submitPublicMappingForReview(inviteToken);
      await refresh();
      setMessage(mappingApproved
        ? "Materiais complementares enviados para análise sem alterar a aprovação do mapeamento."
        : mappingChangesRequested
          ? "Ajustes enviados para uma nova análise do Admin."
          : "Mapeamento enviado para análise do Admin.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07070a] px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <RefreshCw
            className="mx-auto animate-spin text-amber-200"
            size={28}
          />
          <p className="mt-4 text-sm text-zinc-400">Carregando convite...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07070a] px-4 py-6 text-white md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 shadow-2xl shadow-black/30">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                  Privacy IA
                </p>
                {portal && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-300">
                    {statusLabel(portal.invite.status)}
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                {portal?.actor.displayName || "Início do mapeamento"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                Acompanhe sua etapa atual, envie os materiais de referência e
                saiba exatamente o que falta para concluir o mapeamento.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              <LockKeyhole size={20} />
              <div>
                <p className="font-black">Armazenamento protegido</p>
                <p className="text-xs text-emerald-100/70">
                  Acesso restrito e sem URL pública
                </p>
              </div>
            </div>
          </div>
        </header>

        {portal && (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <WorkflowStep
              number={1}
              title="Convite"
              description="Aceite confirmado"
              state={inviteAccepted ? "complete" : "active"}
            />
            <WorkflowStep
              number={2}
              title="Conta"
              description="Acesso confirmado"
              state={
                authLinked ? "complete" : inviteAccepted ? "active" : "pending"
              }
            />
            <WorkflowStep
              number={3}
              title="Materiais"
              description={mappingApproved ? "Conjunto de identidade para vídeos" : "Envio e conferência"}
              state={
                mappingChangesRequested
                  ? "active"
                  : mappingApproved
                    ? identityMaterialsReady
                      ? "complete"
                      : "active"
                    : mappingReadyForReview || mappingSubmittedForReview
                      ? "complete"
                      : authLinked
                        ? "active"
                        : "pending"
              }
            />
            <WorkflowStep
              number={4}
              title="Análise"
              description={mappingApproved ? "Validação do conjunto visual" : "Decisão do Admin"}
              state={
                mappingChangesRequested
                  ? "issue"
                  : mappingApproved
                    ? identityMaterialsReady
                      ? "complete"
                      : supplementalUnderReview || identityPendingReview > 0
                        ? "active"
                        : "pending"
                    : mappingUnderReview
                      ? "active"
                      : "pending"
              }
            />
          </section>
        )}

        <ErrorBox error={error} />
        {message && (
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            <strong>{message}</strong>
          </div>
        )}

        {portal ? (
          <>
            <section
              className={`rounded-[2rem] border p-5 shadow-2xl shadow-black/20 md:p-6 ${mappingChangesRequested ? "border-rose-400/25 bg-rose-400/10" : mappingApproved && identityMaterialsReady ? "border-emerald-400/25 bg-emerald-400/10" : mappingUnderReview || supplementalUnderReview ? "border-sky-400/20 bg-sky-400/10" : "border-amber-300/20 bg-amber-300/[0.07]"}`}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">
                    {currentPhase.eyebrow}
                  </p>
                  <h2 className="mt-2 text-2xl font-black md:text-3xl">
                    {currentPhase.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 opacity-75">
                    {currentPhase.description}
                  </p>
                </div>
                {portal.mappingCase && (
                  mappingApproved && identityDataset ? (
                    <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-2xl font-black">{identityImagesCurrent}/{identityImagesMinimum}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] opacity-60">fotos aprovadas</p>
                        {identityPendingImages > 0 && <p className="mt-1 text-[10px] font-bold text-sky-100/75">+{identityPendingImages} em análise • pode chegar a {identityProjectedImages}/{identityImagesMinimum}</p>}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-2xl font-black">{identityVideosCurrent}/{identityVideosMinimum}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] opacity-60">vídeos aprovados</p>
                        {identityPendingVideos > 0 && <p className="mt-1 text-[10px] font-bold text-sky-100/75">+{identityPendingVideos} em análise • pode chegar a {identityProjectedVideos}/{identityVideosMinimum}</p>}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-2xl font-black">{identityPendingReview}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] opacity-60">em análise</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-2xl font-black">{assets.length}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] opacity-60">arquivos</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-2xl font-black">{completedRequired}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] opacity-60">categorias concluídas</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <p className="text-2xl font-black">{checklist?.missingRequired || 0}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] opacity-60">categorias pendentes</p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>

            {inviteAccepted && portal.mappingCase && rejectedAssets.length > 0 && (
              <section className="rounded-[2rem] border border-rose-400/30 bg-rose-400/10 p-5 shadow-xl shadow-black/20">
                <div className="flex items-start gap-4">
                  <span className="rounded-2xl bg-rose-400/15 p-3 text-rose-100"><AlertTriangle size={24} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-200">Ação necessária</p>
                    <h2 className="mt-1 text-xl font-black">{rejectedAssets.length} material(is) precisa(m) ser substituído(s)</h2>
                    <p className="mt-2 text-sm leading-6 text-rose-100/75">Clique no item devolvido para abrir diretamente o envio da nova versão. O arquivo anterior sairá do conjunto ativo e não será usado no LoRA.</p>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {rejectedAssets.map((asset) => {
                        const requirement = asset.mappingRequirementId ? requirementById.get(asset.mappingRequirementId) : null;
                        return (
                          <button key={asset.id} type="button" onClick={() => prepareReplacement(asset.id, asset.mappingRequirementId)} className="rounded-2xl border border-rose-300/20 bg-black/25 p-3 text-left transition hover:border-rose-200/45">
                            <p className="text-sm font-black text-white">{requirement?.title || asset.originalFilename || "Material devolvido"}</p>
                            <p className="mt-1 text-xs leading-5 text-rose-100/75">{asset.rejectionReason || "Novo envio solicitado."}</p>
                            <p className="mt-2 text-[11px] font-black text-rose-100">{asset.mappingRequirementId && requirement ? "Clique para substituir" : "Aguardando classificação pelo Admin"}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {!inviteAccepted ? (
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <InfoCard>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                    Criação de acesso
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    Confirme seus dados
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Use o mesmo e-mail do convite e crie uma senha própria para
                    o Painel Ator.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Nome artístico"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-300/50"
                    />
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="E-mail do convite"
                      type="email"
                      autoComplete="email"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-300/50"
                    />
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Telefone"
                      autoComplete="tel"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-300/50 sm:col-span-2"
                    />
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Criar senha"
                      type="password"
                      autoComplete="new-password"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-300/50"
                    />
                    <input
                      value={passwordConfirmation}
                      onChange={(event) =>
                        setPasswordConfirmation(event.target.value)
                      }
                      placeholder="Confirmar senha"
                      type="password"
                      autoComplete="new-password"
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-300/50"
                    />
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      Requisitos da senha
                    </p>
                    <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                      {PASSWORD_RULES.map((rule) => {
                        const passed = rule.test(password);
                        return (
                          <span
                            key={rule.label}
                            className={
                              passed ? "text-emerald-200" : "text-zinc-500"
                            }
                          >
                            {passed ? "✓" : "•"} {rule.label}
                          </span>
                        );
                      })}
                      <span
                        className={
                          passwordMatches ? "text-emerald-200" : "text-zinc-500"
                        }
                      >
                        {passwordMatches ? "✓" : "•"} confirmação igual
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegisterAccess}
                    disabled={busy}
                    className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Criar acesso e continuar
                  </button>
                </InfoCard>

                <InfoCard>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                    Como funciona
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    Seu caminho até a aprovação
                  </h2>
                  <div className="mt-5 grid gap-4">
                    {[
                      [
                        "1",
                        "Crie seu acesso",
                        "O convite vincula sua conta ao cadastro feito pelo Admin.",
                      ],
                      [
                        "2",
                        "Envie o mapeamento",
                        "Fotos, vídeos, áudios e documentos ficam armazenados com acesso restrito.",
                      ],
                      [
                        "3",
                        "Aguarde a análise",
                        "O Admin poderá aprovar ou solicitar novos materiais.",
                      ],
                    ].map(([number, title, description]) => (
                      <div
                        key={number}
                        className="flex gap-3 rounded-2xl border border-white/10 bg-black/25 p-4"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-300 text-xs font-black text-zinc-950">
                          {number}
                        </span>
                        <div>
                          <p className="text-sm font-black">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            {description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </InfoCard>
              </div>
            ) : !portal.mappingCase ? (
              <InfoCard className="mx-auto max-w-3xl text-center">
                <UserCheck className="mx-auto text-amber-200" size={34} />
                <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                  Conta vinculada
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  Abra seu mapeamento
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                  A próxima etapa organiza os materiais necessários para a
                  validação da sua identidade e das autorizações de produção.
                </p>
                <button
                  type="button"
                  onClick={handleCreateMapping}
                  disabled={busy}
                  className="mt-6 rounded-2xl bg-amber-300 px-6 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Iniciar mapeamento
                </button>
              </InfoCard>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
                <section className="min-w-0 space-y-5">
                  {mappingChangesRequested && (
                    <InfoCard>
                      <div className="flex items-start gap-4">
                        <span className="rounded-2xl bg-rose-400/10 p-3 text-rose-200">
                          <AlertTriangle size={24} />
                        </span>
                        <div>
                          <h2 className="text-xl font-black">Ajustes liberados</h2>
                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            Corrija somente os itens indicados. Arquivos aprovados, materiais anteriores e todo o histórico continuam salvos neste mesmo mapeamento.
                          </p>
                        </div>
                      </div>
                    </InfoCard>
                  )}

                  {(mappingUnderReview || supplementalUnderReview) && (
                    <InfoCard>
                      <div className="flex items-start gap-4">
                        <span className="rounded-2xl bg-sky-400/10 p-3 text-sky-200">
                          <Clock3 size={24} />
                        </span>
                        <div>
                          <h2 className="text-xl font-black">
                            Análise em andamento
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            Seus materiais estão bloqueados para alteração
                            enquanto o Admin realiza a conferência. Nenhuma ação
                            é necessária agora.
                          </p>
                        </div>
                      </div>
                    </InfoCard>
                  )}

                  {mappingApproved && identityCompletionPlan && (
                    <InfoCard>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/70">Plano para concluir</p>
                          <h2 className="mt-2 text-2xl font-black">O que ainda falta enviar</h2>
                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            Faltam {identityCompletionPlan.remainingImages} foto(s), {identityCompletionPlan.remainingVideos} vídeo(s){identityCompletionPlan.remainingAudio > 0 ? ` e ${identityCompletionPlan.remainingAudio} áudio(s)` : ""}. Clique em um item para preparar exatamente o material solicitado.
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100">{identityCompletionPlan.remainingTotal} item(ns)</span>
                      </div>
                      {identityCompletionTasks.length > 0 ? (
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {identityCompletionTasks.map((task: PublicIdentityCompletionTask) => (
                            <button
                              key={task.id}
                              type="button"
                              disabled={!canEditMaterials}
                              onClick={() => {
                                setIdentityCompletionTaskId(task.id);
                                setMappingRequirementId(task.requirementId);
                                setReplacementAssetId(task.replacementAssetId || "");
                                setFile(null);
                                document.getElementById("envio-material")?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                              className="rounded-2xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-amber-300/35 hover:bg-amber-300/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <div className="flex items-start gap-3">
                                <span className="rounded-xl bg-amber-300/10 p-2 text-amber-100"><MaterialIcon mediaType={task.mediaType} /></span>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-zinc-100">{task.title}</p>
                                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-500">{task.guidance}</p>
                                  <p className="mt-3 text-[11px] font-black uppercase tracking-[0.12em] text-amber-200">Selecionar para envio</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">Nenhum novo material está solicitado. Aguarde a próxima orientação do Admin.</div>
                      )}
                    </InfoCard>
                  )}

                  {mappingApproved && identityMaterialsReady && (
                    <InfoCard>
                      <div className="flex items-start gap-4">
                        <span className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-200">
                          <ShieldCheck size={24} />
                        </span>
                        <div>
                          <h2 className="text-xl font-black">
                            Conjunto de identidade concluído
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            Todas as fotos e os vídeos necessários foram aprovados. Não é preciso enviar novos materiais agora.
                          </p>
                        </div>
                      </div>
                    </InfoCard>
                  )}

                  <InfoCard className={!canUseUpload ? "opacity-75" : ""}>
                    <div id="envio-material" className="scroll-mt-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                            Próxima ação
                          </p>
                          <h2 className="mt-2 text-2xl font-black">
                            Adicionar material
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            Escolha um item da lista do que ainda falta enviar. Assim que o arquivo for recebido, esse item sai automaticamente da seleção. Limite de 25 MB por envio.
                          </p>
                        </div>
                        {selectedMaterial && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs font-black text-zinc-300">
                            <MaterialIcon
                              mediaType={selectedMaterial.mediaType}
                            />{" "}
                            {selectedMaterial.mediaType === "image"
                              ? "Imagem"
                              : selectedMaterial.mediaType === "video"
                                ? "Vídeo"
                                : "Áudio"}
                          </span>
                        )}
                      </div>

                      {replacementAsset && (
                        <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-200">Substituição solicitada</p>
                              <p className="mt-1 text-sm font-black text-white">{replacementAsset.originalFilename || "Material devolvido"}</p>
                              <p className="mt-1 text-xs leading-5 text-rose-100/80">{replacementAsset.rejectionReason || "Envie uma nova versão conforme a orientação do Admin."}</p>
                            </div>
                            <button type="button" onClick={() => { setReplacementAssetId(""); setFile(null); }} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300">Cancelar substituição</button>
                          </div>
                        </div>
                      )}

                      <div className="mt-5 grid gap-4">
                        <label className="grid gap-2">
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                            {mappingApproved ? "O que ainda falta enviar" : "Categoria do material"}
                          </span>
                          {mappingApproved ? (
                            <select
                              disabled={!canUseUpload || Boolean(replacementAsset) || identityCompletionTasks.length === 0}
                              value={selectedCompletionTask?.id || ""}
                              onChange={(event) => {
                                const task = identityCompletionTasks.find((item) => item.id === event.target.value) || null;
                                setIdentityCompletionTaskId(task?.id || "");
                                setMappingRequirementId(task?.requirementId || "");
                                setReplacementAssetId(task?.replacementAssetId || "");
                                setFile(null);
                              }}
                              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {identityCompletionTasks.length === 0 && <option value="">Nenhum novo material solicitado</option>}
                              {identityCompletionTasks.map((task) => (
                                <option key={task.id} value={task.id}>
                                  {task.mediaType === "image" ? "Foto" : task.mediaType === "video" ? "Vídeo" : task.mediaType === "audio" ? "Áudio" : "Material"} · {task.title}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              disabled={!canUseUpload || Boolean(replacementAsset)}
                              value={selectedMaterial?.id || ""}
                              onChange={(event) => {
                                setMappingRequirementId(event.target.value);
                                setReplacementAssetId("");
                                setFile(null);
                              }}
                              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {requirements.length === 0 && <option value="">Nenhum requisito ativo configurado</option>}
                              {requirements.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                            </select>
                          )}
                        </label>

                        {selectedMaterial && (
                          <div className="rounded-2xl border border-sky-300/20 bg-sky-300/[0.07] p-4">
                            <div className="flex items-start gap-3">
                              <span className="rounded-xl bg-sky-300/10 p-2 text-sky-100">
                                <MaterialIcon mediaType={selectedMaterial.mediaType} />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-100/70">Como preparar este material</p>
                                <p className="mt-1 text-sm font-black text-sky-50">{selectedUploadTitle}</p>
                                <p className="mt-2 text-sm leading-6 text-sky-50/80">
                                  {selectedUploadGuidance}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <label
                          className={`flex min-h-44 flex-col items-center justify-center rounded-3xl border border-dashed p-6 text-center transition ${canUseUpload ? "cursor-pointer border-white/15 bg-black/30 hover:border-amber-300/40 hover:bg-amber-300/[0.03]" : "cursor-not-allowed border-white/10 bg-black/20 opacity-60"}`}
                        >
                          <UploadCloud className="text-amber-200" size={30} />
                          <span className="mt-3 text-sm font-black">
                            {file
                              ? file.name
                              : selectedMaterial
                                ? `Selecionar ${selectedUploadTitle}`
                                : "Aguardando requisitos do Admin"}
                          </span>
                          <span className="mt-1 text-xs text-zinc-500">
                            {file
                              ? `${formatFileSize(file.size)} • pronto para envio`
                              : "O arquivo será armazenado com acesso restrito."}
                          </span>
                          <input
                            disabled={!canUseUpload}
                            type="file"
                            accept={selectedMaterial?.accept || ""}
                            className="hidden"
                            onChange={(event) =>
                              setFile(event.target.files?.[0] || null)
                            }
                          />
                        </label>

                        <button
                          type="button"
                          onClick={handleUploadMaterial}
                          disabled={
                            busy ||
                            !file ||
                            !selectedMaterial ||
                            !canUseUpload
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FileUp size={16} />
                          {busy
                            ? "Enviando material..."
                            : "Adicionar ao mapeamento"}
                        </button>
                        <p className="text-xs leading-5 text-zinc-500">
                          Arquivos diferentes podem ser enviados na mesma
                          categoria. Para fotos laterais, use separadamente as
                          categorias Lado Esquerdo e Lado Direito.
                        </p>
                      </div>
                    </div>
                  </InfoCard>

                  <InfoCard>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                          Histórico do envio
                        </p>
                        <h2 className="mt-2 text-2xl font-black">
                          Arquivos adicionados
                        </h2>
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-zinc-400">
                        {assets.length} arquivo(s)
                      </span>
                    </div>
                    <div className="mt-5 grid gap-3">
                      {sortedAssets.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                          Nenhum material enviado ainda.
                        </div>
                      )}
                      {sortedAssets.map((asset) => {
                        const requirement = asset.mappingRequirementId
                          ? requirementById.get(asset.mappingRequirementId)
                          : null;
                        const rejected = asset.status === "rejected";
                        return (
                          <div
                            key={asset.id}
                            className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center ${rejected ? "border-rose-400/20 bg-rose-400/[0.06]" : "border-white/10 bg-black/25"}`}
                          >
                            <span
                              className={`rounded-xl p-2 ${rejected ? "bg-rose-400/10 text-rose-200" : "bg-white/5 text-zinc-300"}`}
                            >
                              <MaterialIcon
                                mediaType={
                                  requirement?.mediaType ||
                                  asset.contentType?.split("/")[0]
                                }
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-zinc-100">
                                {asset.originalFilename ||
                                  asset.assetType ||
                                  "Material enviado"}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {requirement?.title ||
                                  asset.assetType ||
                                  "Categoria não identificada"}{" "}
                                • {formatFileSize(asset.byteSize)}
                              </p>
                              {asset.rejectionReason && (
                                <p className="mt-2 text-xs text-rose-200">
                                  Ajuste solicitado: {asset.rejectionReason}
                                </p>
                              )}
                            </div>
                            <div className="text-left sm:text-right">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${rejected ? "border-rose-400/20 bg-rose-400/10 text-rose-100" : "border-amber-300/15 bg-amber-300/[0.06] text-amber-100"}`}
                              >
                                {statusLabel(asset.status)}
                              </span>
                              {formatDateTime(asset.createdAt) && (
                                <p className="mt-2 text-[10px] text-zinc-600">
                                  {formatDateTime(asset.createdAt)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </InfoCard>
                </section>

                <aside className="space-y-5 lg:sticky lg:top-5">
                  <InfoCard>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Seu progresso</p>
                        <h2 className="mt-2 text-2xl font-black">
                          {mappingApproved ? "Conjunto de identidade para vídeos" : "Materiais solicitados"}
                        </h2>
                      </div>
                      {(mappingApproved ? identityMaterialsReady : checklist?.isComplete) ? (
                        <ShieldCheck className="text-emerald-200" />
                      ) : (
                        <AlertTriangle className="text-amber-200" />
                      )}
                    </div>
                    {mappingApproved && identityDataset ? (
                      <div className="mt-5 space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
                            <span>Fotos aprovadas</span>
                            <span>{identityImagesCurrent}/{identityImagesMinimum}</span>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${identityImageProgress}%` }} />
                          </div>
                          {identityPendingImages > 0 && <p className="mt-2 text-[11px] leading-5 text-sky-100/70">{identityPendingImages} foto(s) aguardando análise. Se forem aprovadas, o total poderá chegar a {identityProjectedImages}/{identityImagesMinimum}.</p>}
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
                            <span>Vídeos aprovados</span>
                            <span>{identityVideosCurrent}/{identityVideosMinimum}</span>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${identityVideoProgress}%` }} />
                          </div>
                          {identityPendingVideos > 0 && <p className="mt-2 text-[11px] leading-5 text-sky-100/70">{identityPendingVideos} vídeo(s) aguardando análise. Se forem aprovados, o total poderá chegar a {identityProjectedVideos}/{identityVideosMinimum}.</p>}
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-zinc-400">
                          Progresso aprovado: {identityOverallProgress}%. Materiais em análise aparecem separadamente e só entram na contagem depois da aprovação. Áudios, documentos e versões substituídas não contam como novas fotos ou vídeos.
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                          <span>{completedRequired}/{totalRequired} categorias obrigatórias</span>
                          <span>{Math.round(progressPercent)}%</span>
                        </div>
                      </>
                    )}

                    {mappingApproved && (
                      <div className="mt-5 border-t border-white/10 pt-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">Categorias do mapeamento geral</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-600">Os cartões verdes abaixo confirmam apenas que cada categoria mínima possui material aprovado. Você pode enviar arquivos adicionais para atingir as metas visuais acima.</p>
                      </div>
                    )}
                    <div className="mt-4 grid gap-2">
                      {checklistGroups.map((group) => {
                        const isSelected =
                          selectedMaterial?.id === group.requirementId;
                        const rejected =
                          group.status === "rejected" ||
                          Boolean(group.rejectionReason);
                        const rejectedAsset = rejectedAssets
                          .filter((asset) => asset.mappingRequirementId === group.requirementId)
                          .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))[0] || null;
                        return (
                          <button
                            key={group.requirementId}
                            type="button"
                            disabled={!canEditMaterials && !(rejected && rejectedAsset)}
                            onClick={() => {
                              if (rejected && rejectedAsset) {
                                prepareReplacement(rejectedAsset.id, rejectedAsset.mappingRequirementId);
                                return;
                              }
                              setReplacementAssetId("");
                              setMappingRequirementId(group.requirementId);
                              setFile(null);
                              document
                                .getElementById("envio-material")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                            }}
                            className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${isSelected ? "border-amber-300/35 bg-amber-300/10" : rejected ? "border-rose-400/20 bg-rose-400/[0.06]" : group.present ? "border-emerald-400/15 bg-emerald-400/[0.05]" : "border-white/10 bg-black/25"} ${canEditMaterials || (rejected && rejectedAsset) ? "hover:border-white/25" : "cursor-default"}`}
                          >
                            <span
                              className={`mt-0.5 ${rejected ? "text-rose-200" : group.present ? "text-emerald-200" : "text-zinc-600"}`}
                            >
                              {rejected ? (
                                <XCircle size={18} />
                              ) : group.present ? (
                                <CheckCircle2 size={18} />
                              ) : (
                                <Circle size={18} />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-black text-zinc-100">
                                  {group.label}
                                </p>
                                {group.totalAssets > 0 && (
                                  <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-zinc-400">
                                    {group.totalAssets}
                                  </span>
                                )}
                              </div>
                              <p
                                className={`mt-1 text-xs leading-5 ${rejected ? "text-rose-200/80" : "text-zinc-500"}`}
                              >
                                {rejected
                                  ? `${group.rejectionReason || "Novo envio solicitado."} Clique para substituir este material.`
                                  : group.present
                                    ? "Recebido — você pode enviar arquivos adicionais."
                                    : group.description || (group.required
                                      ? "Obrigatório — ainda não enviado."
                                      : "Opcional.")}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </InfoCard>

                  <InfoCard>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                      Próxima etapa
                    </p>
                    <h2 className="mt-2 text-xl font-black">
                      Enviar para análise
                    </h2>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-300">
                      {mappingApproved && supplementalUnderReview
                        ? "Os materiais complementares estão em análise. A aprovação geral permanece preservada."
                        : mappingApproved
                          ? supplementalPendingAssets > 0
                            ? `${supplementalPendingAssets} novo(s) material(is) pronto(s) para envio ao Admin.`
                            : "Mapeamento aprovado. Adicione fotos e vídeos complementares para avançar na identidade de vídeo."
                        : mappingUnderReview
                          ? "Seus materiais já estão em análise."
                          : mappingChangesRequested
                            ? "Faça os ajustes indicados e envie este mesmo mapeamento novamente. Nada será apagado."
                            : mappingReadyForReview
                              ? "Todos os materiais obrigatórios foram recebidos."
                              : `Ainda faltam ${checklist?.missingRequired || 0} categoria(s) obrigatória(s).`}
                    </div>
                    <button
                      type="button"
                      onClick={handleSubmitMappingReview}
                      disabled={
                        busy ||
                        (!mappingApproved && !mappingReadyForReview) ||
                        mappingUnderReview ||
                        supplementalUnderReview ||
                        (mappingApproved && supplementalPendingAssets === 0)
                      }
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {mappingUnderReview || supplementalUnderReview ? (
                        <Clock3 size={16} />
                      ) : mappingApproved ? (
                        <Send size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                      {mappingApproved && supplementalUnderReview
                        ? "Complementação em análise"
                        : mappingApproved
                          ? "Enviar complementos para análise"
                        : mappingUnderReview
                          ? "Em análise pelo Admin"
                          : mappingChangesRequested
                            ? "Enviar ajustes para nova análise"
                            : "Enviar mapeamento para análise"}
                    </button>
                  </InfoCard>

                  <InfoCard>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                      Painel Ator
                    </p>
                    <h2 className="mt-2 text-xl font-black">
                      Acesso de preparação
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Enquanto o mapeamento não for aprovado, o painel permanece
                      limitado às áreas liberadas para perfil e acompanhamento.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/atriz")}
                      className="mt-4 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white"
                    >
                      Abrir Painel Ator
                    </button>
                  </InfoCard>
                </aside>
              </div>
            )}
          </>
        ) : (
          <InfoCard>
            <p className="text-sm text-zinc-400">
              Convite não encontrado ou indisponível.
            </p>
          </InfoCard>
        )}
      </div>
    </main>
  );
}
