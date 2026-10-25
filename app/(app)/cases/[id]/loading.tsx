import { SkeletonCards } from "@/components/ui";

export default function ResultLoading() {
  return (
    <div className="scr">
      <div className="topbar">
        <div className="sk" style={{ width: 120, height: 14, borderRadius: 6 }} aria-hidden="true" />
      </div>
      <div className="body">
        <div className="stack" aria-hidden="true">
          <div className="sk" style={{ height: 48, borderRadius: 10, marginBottom: 4 }} />
          <div className="sk" style={{ height: 24, width: "60%", borderRadius: 6 }} />
        </div>
        <SkeletonCards n={3} />
      </div>
    </div>
  );
}
