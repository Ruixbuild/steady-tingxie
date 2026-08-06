// Scopes the parent-corner button-size override in globals.css (.parent-corner
// .btn/.btn-sm) to this route tree only, so it never touches the shared .btn
// classes used by Ting Xie's child-facing screens (Learn/Test/etc.), which
// keep their original, larger tap targets.
export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <div className="parent-corner">{children}</div>;
}
