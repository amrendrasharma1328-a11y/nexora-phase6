import EmptyState from '../components/ui/EmptyState.jsx';

/** Temporary page for sections built in later phases. */
export default function PlaceholderPage({ name, phase }) {
  return (
    <EmptyState
      title={`${name} is not built yet`}
      description={`This section is planned for ${phase}. No data is shown here and nothing is simulated.`}
    />
  );
}
