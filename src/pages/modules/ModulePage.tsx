import type * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { findNavIn, useNavGroups } from '../../config/nav';
import { PageHeader } from '../../components/ui/PageHeader';
import NotFound from '../system/NotFound';

const ModulePage: React.FC = () => {
  const { pathname } = useLocation();
  const groups = useNavGroups();
  const found = findNavIn(groups, pathname);
  if (!found) return <NotFound />;
  const { item, group } = found;
  const Icon = item.icon;

  return (
    <div>
      <PageHeader title={item.label} subtitle={item.hint} />
      <div className="grid min-h-[48vh] place-items-center rounded-2xl border border-dashed border-line bg-panel/60 px-6 py-16 text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Icon size={26} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold">{item.label} is empty</h2>
          <p className="mt-1.5 text-sm text-mute">
            This {group.title.toLowerCase()} tab is set up and routed. Its screen has not been built yet.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-soft px-3 py-1.5 text-xs font-semibold text-mute">
            <Hammer size={13} aria-hidden />
            #{item.to}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModulePage;
