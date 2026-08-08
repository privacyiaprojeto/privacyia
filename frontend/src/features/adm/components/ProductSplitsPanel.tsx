import { useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, Coins, Loader2, Plus, Store, Trash2, UserRound } from 'lucide-react'
import { useProductSplits, useReplaceProductSplits, useSplitBeneficiaries } from '@/features/adm/hooks/useSceneDirection'
import type { BeneficiaryType, ProductSplitDto } from '@/features/adm/api/sceneDirectionApi'
import { parseApiError } from '@/shared/utils/parseApiError'

interface ProductSplitsPanelProps {
  productId: string
}

function emptySplit(index: number): ProductSplitDto {
  return {
    beneficiaryId: '',
    beneficiaryType: 'actor',
    beneficiaryName: '',
    splitPercentage: 0,
    displayOnStorefront: true,
    sortOrder: index,
  }
}

export function ProductSplitsPanel({ productId }: ProductSplitsPanelProps) {
  const splitsQuery = useProductSplits(productId)
  const beneficiariesQuery = useSplitBeneficiaries()
  const saveMutation = useReplaceProductSplits()
  const [rows, setRows] = useState<ProductSplitDto[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!splitsQuery.data) return
    setRows(splitsQuery.data.items.map((item, index) => ({ ...item, sortOrder: index })))
  }, [splitsQuery.data])

  const beneficiaries = beneficiariesQuery.data?.items || []
  const selectedKeys = useMemo(() => new Set(rows.map((row) => `${row.beneficiaryType}:${row.beneficiaryId}`).filter((key) => !key.endsWith(':'))), [rows])
  const beneficiariesPercent = rows.reduce((sum, row) => sum + Number(row.splitPercentage || 0), 0)
  const platformPercent = Math.max(100 - beneficiariesPercent, 0)
  const invalid = rows.some((row) => !row.beneficiaryId || !row.beneficiaryName || Number(row.splitPercentage) < 0) || beneficiariesPercent > 100

  function addRow() {
    if (rows.length >= 3) return
    setRows((current) => [...current, emptySplit(current.length)])
    setMessage(null)
    setError(null)
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, sortOrder: rowIndex })))
    setMessage(null)
    setError(null)
  }

  function selectBeneficiary(index: number, value: string) {
    const [type, id] = value.split(':') as [BeneficiaryType, string]
    const beneficiary = beneficiaries.find((item) => item.id === id && item.type === type)
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? {
      ...row,
      beneficiaryId: id || '',
      beneficiaryType: type || 'actor',
      beneficiaryName: beneficiary?.name || '',
    } : row))
    setMessage(null)
    setError(null)
  }

  function updatePercent(index: number, value: string) {
    const parsed = Number(value.replace(',', '.'))
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, splitPercentage: Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 100) : 0 } : row))
    setMessage(null)
    setError(null)
  }

  async function save() {
    if (invalid) {
      setError('Revise os beneficiários e mantenha a soma dos repasses em até 100%.')
      return
    }

    setError(null)
    setMessage(null)
    try {
      const result = await saveMutation.mutateAsync({
        productId,
        splits: rows.map((row, index) => ({ ...row, sortOrder: index })),
      })
      setMessage(result.message || 'Vitrine e repasses salvos.')
    } catch (saveError) {
      setError(parseApiError(saveError) || 'Não foi possível salvar os repasses agora.')
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-fuchsia-300/20 bg-fuchsia-300/[0.06] p-5" data-admin-product-splits="true">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-100">Gestão de Vitrine e Repasse</p>
          <h4 className="mt-1 text-xl font-black text-white">Até três beneficiários por produto</h4>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">Defina quem recebe comissão e escolha em quais vitrines o produto poderá aparecer. O restante fica com a plataforma.</p>
        </div>
        <button type="button" onClick={addRow} disabled={rows.length >= 3} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/30 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-fuchsia-100 transition hover:bg-fuchsia-300/10 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={15} /> Adicionar beneficiário</button>
      </div>

      {splitsQuery.isLoading || beneficiariesQuery.isLoading ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-zinc-300"><Loader2 className="animate-spin" size={16} /> Carregando beneficiários…</div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((row, index) => {
            const selectedValue = row.beneficiaryId ? `${row.beneficiaryType}:${row.beneficiaryId}` : ''
            const Icon = row.beneficiaryType === 'company' ? Building2 : UserRound
            return (
              <div key={`${row.beneficiaryType}-${row.beneficiaryId || 'new'}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_minmax(210px,0.8fr)_44px] lg:items-end">
                  <label className="block"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Beneficiário {index + 1}</span><div className="relative mt-2"><Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} /><select value={selectedValue} onChange={(event) => selectBeneficiary(index, event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-3 text-sm font-bold text-white outline-none"><option value="">Selecione ator ou empresa</option>{beneficiaries.map((beneficiary) => { const key = `${beneficiary.type}:${beneficiary.id}`; const usedByOther = selectedKeys.has(key) && key !== selectedValue; return <option key={key} value={key} disabled={usedByOther}>{beneficiary.name} — {beneficiary.type === 'company' ? 'Empresa' : 'Ator/Atriz'}</option> })}</select></div></label>
                  <label className="block"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Repasse</span><div className="relative mt-2"><input type="number" min={0} max={100} step="0.01" value={row.splitPercentage} onChange={(event) => updatePercent(index, event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 pr-8 text-sm font-black text-white outline-none" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-500">%</span></div></label>
                  <label className="flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-3"><input type="checkbox" checked={row.displayOnStorefront} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, displayOnStorefront: event.target.checked } : item))} className="size-4 accent-fuchsia-400" /><span><strong className="block text-xs text-white">Exibir na vitrine deste perfil</strong><span className="mt-0.5 block text-[10px] text-zinc-500">Desmarque para pagar comissão sem mostrar o produto.</span></span></label>
                  <button type="button" onClick={() => removeRow(index)} className="grid size-11 place-items-center rounded-xl border border-rose-300/20 text-rose-100 transition hover:bg-rose-300/10" aria-label={`Remover beneficiário ${index + 1}`}><Trash2 size={16} /></button>
                </div>
              </div>
            )
          })}
          {rows.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center"><Coins className="mx-auto text-zinc-600" size={22} /><p className="mt-2 text-sm font-black text-white">Nenhum beneficiário configurado</p><p className="mt-1 text-xs text-zinc-500">A plataforma retém 100% até que um repasse seja cadastrado.</p></div>}
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {rows.map((row, index) => <div key={`${row.beneficiaryId}-${index}-summary`} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center gap-2 text-zinc-500"><Store size={14} /><span className="truncate text-xs font-black uppercase tracking-[0.12em]">{row.beneficiaryName || `Beneficiário ${index + 1}`}</span></div><strong className="mt-2 block text-2xl font-black text-white">{Number(row.splitPercentage || 0).toFixed(2).replace('.00', '')}%</strong><span className="mt-1 block text-xs text-zinc-500">{row.displayOnStorefront ? 'Com vitrine' : 'Somente comissão'}</span></div>)}
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4"><div className="flex items-center gap-2 text-emerald-100"><CheckCircle2 size={14} /><span className="text-xs font-black uppercase tracking-[0.12em]">Plataforma</span></div><strong className="mt-2 block text-2xl font-black text-white">{platformPercent.toFixed(2).replace('.00', '')}%</strong><span className="mt-1 block text-xs text-emerald-50/70">Percentual restante</span></div>
      </div>

      {beneficiariesPercent > 100 && <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">A soma atual é {beneficiariesPercent.toFixed(2)}%. Reduza para no máximo 100%.</p>}
      {error && <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{error}</p>}
      {message && <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">{message}</p>}

      <button type="button" onClick={save} disabled={invalid || saveMutation.isPending} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">{saveMutation.isPending ? <><Loader2 className="animate-spin" size={16} /> Salvando…</> : 'Salvar vitrine e repasses'}</button>
    </section>
  )
}
