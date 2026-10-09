import React from 'react';
import { useAuth } from '../auth/AuthContext';

const Dashboard = ({ onStartOperation }) => {
  const { user } = useAuth();
  const tenant = user?.tenant;
  const createdAt = tenant?.createdAt
    ? new Date(tenant.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div style={styles.container}>
      {/* 1. Bannière d'avertissement supérieure */}
      

      <div style={styles.content}>
        {/* 2. Carte principale du Tenant */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h1 style={styles.title}>{tenant?.name}</h1>
              <p style={styles.tenantId}>{tenant?.id}</p>
            </div>
            
            {/* Badges d'état */}
            <div style={styles.badgeGroup}>
              <span style={styles.activeBadge}>Actif</span>
            </div>
          </div>

          {/* Description dynamique */}
          <p style={styles.description}>
            Périmètre : chiffrement, déchiffrement, hashage et signature pour ce tenant uniquement.
            {createdAt ? ` Créé le ${createdAt}.` : ''}
          </p>
          <p style={styles.description}>
            E-mail du tenant (chiffré en base) : {tenant?.email}
          </p>

          {/* Bouton d'action principal */}
          <button 
            style={styles.primaryButton}
            onClick={onStartOperation}
          >
            Commencer une opération
          </button>
        </div>
      </div>
    </div>
  );
};

// Styles CSS-in-JS correspondant au design de la capture d'écran
const styles = {
  container: {
    backgroundColor: '#0a0d14',
    minHeight: '100vh',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    paddingBottom: '2rem',
  },
  warningBanner: {
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderBottom: '1px solid rgba(217, 119, 6, 0.2)',
    color: '#f59e0b',
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  content: {
    maxWidth: '1200px',
    margin: '2rem auto',
    padding: '0 1.5rem',
  },
  card: {
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '12px',
    padding: '1.75rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0,
    marginBottom: '0.25rem',
  },
  tenantId: {
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    color: '#64748b',
    margin: 0,
  },
  badgeGroup: {
    display: 'flex',
    gap: '0.5rem',
  },
  activeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#10b981',
    padding: '0.25rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  description: {
    fontSize: '0.95rem',
    color: '#94a3b8',
    marginBottom: '1.75rem',
    lineHeight: '1.5',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.65rem 1.25rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
};

export default Dashboard;