import { Info } from "@/components/icons";
import { PLATFORMS } from "@/lib/platforms";

// Lookup table of platform limits. Collapsed by default; one platform for now.
export function LimitsCard() {
  return (
    <details className="card group p-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-[14px] font-medium text-ink-soft hover:text-ink">
        <Info size={16} />
        Limits to keep in mind
        <span className="ml-auto text-[12px] font-normal text-ink-faint group-open:hidden">Show</span>
        <span className="ml-auto hidden text-[12px] font-normal text-ink-faint group-open:inline">Hide</span>
      </summary>
      <div className="border-t border-line px-5 pt-3 pb-4">
        {PLATFORMS.map((p) => (
          <div key={p.key}>
            <h3 className="mb-2 text-[15px] font-semibold">{p.name}</h3>
            <table className="w-full text-[13px]">
              <tbody>
                {p.limits.map((l) => (
                  <tr key={l.label} className="border-t border-line/70 first:border-t-0">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-soft">
                      {l.label}
                    </th>
                    <td className="py-1.5 text-right">
                      <span className="tabular-nums">{l.value}</span>
                      {l.note && <span className="ml-1.5 text-ink-faint">{l.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </details>
  );
}
