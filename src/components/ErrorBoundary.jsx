import { Component } from "react";
import { CircleAlert } from "lucide-react";

// Stops a crash from blanking the app. The route-level boundary keeps the header and menu working;
// the outer one (fullPage) catches anything else. Links are plain <a> so they work without the router.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Pub Bingo crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const box = (
      <section className="card state-box error" role="alert">
        <CircleAlert className="state-icon" aria-hidden="true" />
        <strong>{this.props.fullPage ? "Pub Bingo stopped working" : "This page stopped working"}</strong>
        <span className="muted">Your prices, favourites and bingo card are saved. Reload to try again, or go back to the home page.</span>
        <div className="row-actions wrap">
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>Reload</button>
          <a className="secondary-button" href="/">Go to the home page</a>
        </div>
      </section>
    );
    return this.props.fullPage ? <main className="config-error">{box}</main> : box;
  }
}
