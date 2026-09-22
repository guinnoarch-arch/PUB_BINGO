import { Component } from "react";

// Stops one broken page from blanking the whole app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card state-box error" role="alert">
        <strong>This page hit a problem.</strong>
        <span className="muted">Your data is safe. Try reloading.</span>
        <button type="button" className="secondary-button" onClick={() => window.location.reload()}>Reload</button>
      </section>
    );
  }
}
