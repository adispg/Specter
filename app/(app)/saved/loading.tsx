import { SkeletonRows } from "@/components/ui";

export default function SavedLoading() {
  return (
    <div className="scr">
      <div className="topbar">
        <div className="sk" style={{ width: 80, height: 14, borderRadius: 6 }} aria-hidden="true" />
      </div>
      <div className="body">
        <SkeletonRows n={4} />
      </div>
    </div>
  );
}
