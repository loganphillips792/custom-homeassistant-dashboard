import { Component, Suspense, type ReactNode } from "react";
import type { WidgetInstance } from "@dashboard/shared";
import { getWidget } from "./widgetRegistry.ts";

function Placeholder({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="placeholder">
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}

interface BoundaryProps {
  /** A new value clears a caught error, so fixing a widget's settings can recover it. */
  resetKey: string;
  children: ReactNode;
}

class WidgetErrorBoundary extends Component<BoundaryProps, { failedKey: string | null }> {
  override state = { failedKey: null as string | null };

  override componentDidCatch(error: unknown) {
    console.error("A widget failed to render:", error);
    this.setState({ failedKey: this.props.resetKey });
  }

  static getDerivedStateFromError() {
    return null;
  }

  override render() {
    if (this.state.failedKey === this.props.resetKey) {
      return <Placeholder title="This widget crashed" detail="The rest of the dashboard is fine." />;
    }
    return this.props.children;
  }
}

export function WidgetHost({ widget }: { widget: WidgetInstance }) {
  const registered = getWidget(widget.type);
  if (!registered) {
    return <Placeholder title="Unknown widget" detail={`No widgets/${widget.type} folder`} />;
  }

  const settings = registered.definition.schema.safeParse(widget.settings);
  if (!settings.success) {
    return <Placeholder title={registered.definition.title} detail="Needs setup" />;
  }

  const { Component: Widget } = registered;
  return (
    <WidgetErrorBoundary resetKey={JSON.stringify(widget.settings)}>
      <Suspense fallback={<div className="placeholder" />}>
        <Widget settings={settings.data} />
      </Suspense>
    </WidgetErrorBoundary>
  );
}
