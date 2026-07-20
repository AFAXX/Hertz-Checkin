  const handleDeleteContract = async (id: string) => {
    try {
      const r = await fetch('/api/admin/contracts?id=' + id, { method: 'DELETE' });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || 'Eliminazione fallita');
      }
      setDeleteConfirm(null);
      setSelectedContracts(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      loadContracts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore durante l\'eliminazione');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedContracts.size === 0) return;
    const ids = Array.from(selectedContracts);
    try {
      for (const id of ids) {
        const r = await fetch('/api/admin/contracts?id=' + id, { method: 'DELETE' });
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || `Eliminazione fallita per il contratto ${id}`);
        }
      }
      setSelectedContracts(new Set());
      setDeleteAllConfirm(false);
      loadContracts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore durante l\'eliminazione');
    }
  };
