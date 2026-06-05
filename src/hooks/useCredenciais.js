import { useState, useEffect } from 'react';

const KEY = 'uniko_7b_creds';

export function useCredenciais() {
  const [credUser, setCredUserRaw] = useState('');
  const [credPass, setCredPassRaw] = useState('');
  const [saved,    setSaved]       = useState(false);
  const [editing,  setEditing]     = useState(false);

  // Carrega do localStorage na montagem
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const { u, p } = JSON.parse(raw);
      if (u && p) { setCredUserRaw(u); setCredPassRaw(p); setSaved(true); }
    } catch {}
  }, []);

  const setCredUser = (v) => { setCredUserRaw(v); setSaved(false); };
  const setCredPass = (v) => { setCredPassRaw(v); setSaved(false); };

  const saveCredentials = () => {
    if (!credUser || !credPass) return;
    localStorage.setItem(KEY, JSON.stringify({ u: credUser, p: credPass }));
    setSaved(true);
    setEditing(false);
  };

  const clearCredentials = () => {
    localStorage.removeItem(KEY);
    setSaved(false);
    setEditing(true);
    setCredUserRaw('');
    setCredPassRaw('');
  };

  return {
    credUser, setCredUser,
    credPass, setCredPass,
    saved, editing, setEditing,
    saveCredentials, clearCredentials,
  };
}
