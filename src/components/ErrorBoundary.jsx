import React from "react";
import ErrorState from "@/components/ErrorState";

// Catch-all for render errors: keeps the rest of the app usable and tells the
// user what happened, that their data is safe, and what to do (directive §29).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Legit operational signal; never user-visible raw text.
    console.error("Render error:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="This screen hit an unexpected error"
          description="The rest of your semester is safe. Reload this screen to keep going, and if it keeps happening, let us know what you were doing."
          onRetry={this.reset}
          retryLabel="Reload screen"
        />
      );
    }
    return this.props.children;
  }
}