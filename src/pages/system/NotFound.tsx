import type * as React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

const NotFound: React.FC = () => (
  <div className="grid min-h-[55vh] place-items-center px-4 text-center">
    <div className="max-w-sm">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
        <Compass size={26} aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-mute">That address does not match any SmartX page. Check the menu or go back to the dashboard.</p>
      <Link to="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink hover:brightness-110">
        Back to dashboard
      </Link>
    </div>
  </div>
);

export default NotFound;
