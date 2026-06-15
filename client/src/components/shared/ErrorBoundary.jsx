import React from 'react';
import PropTypes from 'prop-types';
import ErrorScreen from './ErrorScreen';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <ErrorScreen
            message="Виникла непередбачена помилка. Спробуйте перезавантажити сторінку."
            onAction={() => globalThis.location.reload()}
            actionLabel="Перезавантажити"
          />
          {import.meta.env.DEV && (
            <pre style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              maxHeight: '200px', overflow: 'auto',
              background: '#1a1a1a', color: '#ff6b6b',
              padding: '12px', fontSize: '12px', zIndex: 9999,
              margin: 0,
            }}>
              {this.state.error?.toString()}
            </pre>
          )}
        </>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
};
