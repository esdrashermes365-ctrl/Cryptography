import { NavLink } from 'react-router-dom';

const operations = [
  { label: 'Chiffrer', path: '/encryption' },
  { label: 'Déchiffrer', path: '/decryption' },
  { label: 'Hashage', path: '/hashing' },
  { label: 'Signature', path: '/rsa-signature' },
];

export default function OperationTabs() {
  return (
    <nav aria-label="Opérations cryptographiques" style={styles.tabBar}>
      {operations.map((operation) => (
        <NavLink
          key={operation.path}
          to={operation.path}
          style={({ isActive }) => ({
            ...styles.tab,
            ...(isActive ? styles.activeTab : {}),
          })}
        >
          {operation.label}
        </NavLink>
      ))}
    </nav>
  );
}

const styles = {
  tabBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1.5rem',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '0.5rem',
    marginBottom: '2rem',
  },
  tab: {
    color: '#94a3b8',
    fontSize: '0.95rem',
    fontWeight: '500',
    textDecoration: 'none',
    paddingBottom: '0.5rem',
    borderBottom: '2px solid transparent',
  },
  activeTab: {
    color: '#ffffff',
    fontWeight: '600',
    borderBottomColor: '#3b82f6',
  },
};
