import React from 'react';
import PropTypes from 'prop-types';
import AppLayout from '../../../../components/layout/AppLayout';

/**
 * SessionLayout — лейаут сторінки сесії.
 *
 * @param {React.ReactNode} topBar — верхня навігація
 * @param {React.ReactNode} leftPanel — лівий контент (70%)
 * @param {React.ReactNode} rightPanel — правий контент (30%)
 */
export default function SessionLayout({ topBar, leftPanel, rightPanel, leftLabel = 'Сесія', rightLabel = 'Деталі' }) {
  return (
    <AppLayout
      topBar={topBar}
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      leftLabel={leftLabel}
      rightLabel={rightLabel}
    />
  );
}

SessionLayout.propTypes = {
  topBar: PropTypes.node,
  leftPanel: PropTypes.node,
  rightPanel: PropTypes.node,
  leftLabel: PropTypes.string,
  rightLabel: PropTypes.string,
};
