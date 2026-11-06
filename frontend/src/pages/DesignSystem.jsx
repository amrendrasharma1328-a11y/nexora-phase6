import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import LoadingIndicator from '../components/ui/LoadingIndicator.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import { tokens } from '../design/tokens.js';

/** DEV-ONLY component gallery. Not part of the product UI. */
export default function DesignSystem() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Badge tone="magenta">Dev only</Badge>

      <Card meta="Tokens" title="Colors">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(tokens.colors).map(([name, hex]) => (
            <li key={name} className="border border-border">
              <div className="h-12" style={{ background: hex }} />
              <p className="px-2 py-1 font-mono text-[0.6875rem] uppercase text-body">{name}<br />{hex}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card meta="Tokens" title="Typography">
        <p className="text-2xl font-semibold">IBM Plex Sans — headings and display</p>
        <p className="mt-2 font-mono text-sm">IBM Plex Mono — metadata and technical information</p>
        <p className="nx-label mt-2">Compact uppercase label</p>
      </Card>

      <Card meta="Components" title="Buttons and badges">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Badge tone="green">Active</Badge>
          <Badge tone="cyan">Info</Badge>
          <Badge tone="magenta">Special</Badge>
          <Badge>Neutral</Badge>
        </div>
      </Card>

      <Card meta="Components" title="Inputs">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Source" placeholder="Enter a location" hint="Helper text" />
          <Input label="Destination" defaultValue="Invalid value" error="This field has an error" />
          <SearchInput value={query} onChange={setQuery} placeholder="Search places…" />
        </div>
      </Card>

      <Card meta="Components" title="Overlays and feedback">
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip content="Tooltip text"><Button variant="secondary">Hover or focus me</Button></Tooltip>
          <Button onClick={() => setOpen(true)}>Open modal</Button>
          <LoadingIndicator label="Loading" />
        </div>
        <Modal open={open} onClose={() => setOpen(false)} title="Example modal" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => setOpen(false)}>Confirm</Button></>}>
          <p>Focus is trapped here. Press Escape to close.</p>
        </Modal>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <EmptyState title="Nothing here yet" description="Empty state example." />
        <ErrorState message="Example error message" onRetry={() => {}} />
      </div>
    </div>
  );
}
