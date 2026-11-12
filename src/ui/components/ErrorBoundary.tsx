/** Catches render errors so a failing part shows a friendly note instead of a blank screen. */
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** rendered instead of the children after an error; receives a reset callback */
  fallback(error: Error, reset: () => void): ReactNode;
  /** changing this clears the error */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
  key: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.key) return { key: props.resetKey, error: null };
    return null;
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, () => this.setState({ error: null }));
    return this.props.children;
  }
}
