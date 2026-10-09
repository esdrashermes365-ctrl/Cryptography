import { NavLink } from 'react-router-dom';
import { navItems } from '../navigation';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-[#0b0f17] border-r border-slate-800/80 p-4 flex flex-col shrink-0 text-slate-300">
      <nav className="space-y-1">
        {navItems.map((item) => {
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `block w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-[#161f30] text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-[#111622]'
              }`}
            >
              {item.name}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}