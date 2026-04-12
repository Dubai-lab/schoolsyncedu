import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { nfcCardService } from '@/services/nfcService';
import type { NfcCardStatusView, NfcCardStatus } from '@/types/nfc.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import {
  Wifi,
  CreditCard,
  Search,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Timer,
  ArrowRight,
  Smartphone,
  Zap,
} from 'lucide-react';

// ==================== TYPES ====================

type CardWithStudent = {
  id: string;
  card_number: string;
  status: string;
  student_id: string;
  nfc_chip_id: string | null;
  valid_until: string | null;
  created_at: string;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    registration_number: string;
    current_grade_level: string;
    photo_url: string | null;
  };
};

// students nested under nfc_cards — matches the PostgREST join shape
type AssignmentRecord = {
  id: string;
  card_id: string;
  assigned_to_student: string;
  assigned_by: string;
  assignment_method: string;
  assignment_date: string;
  nfc_cards: {
    card_number: string;
    status: string;
    nfc_chip_id: string | null;
    students: { first_name: string; last_name: string; registration_number: string } | null;
  } | null;
};

// ==================== NFC STATUS PIPELINE ====================

function StatusPipeline({ status }: { status: string }) {
  const steps = ['designed', 'printed', 'encoded', 'active'];
  const currentIdx = steps.indexOf(status);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center gap-1">
          <div className={`h-2 w-2 rounded-full ${
            idx <= currentIdx ? 'bg-blue-500' : 'bg-slate-200'
          }`} />
          {idx < steps.length - 1 && (
            <div className={`h-px w-4 ${
              idx < currentIdx ? 'bg-blue-400' : 'bg-slate-200'
            }`} />
          )}
        </div>
      ))}
      <span className="text-xs text-slate-500 ml-1 capitalize">{status}</span>
    </div>
  );
}

// ==================== MAIN ====================

export default function NfcAssignment() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [tab, setTab] = useState<'pending' | 'assigned'>('pending');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected card for NFC assignment
  const [selectedCard, setSelectedCard] = useState<CardWithStudent | null>(null);
  const [nfcChipId, setNfcChipId] = useState('');
  const [assignMethod, setAssignMethod] = useState<'manual' | 'external_reader' | 'pwa_scan'>('manual');

  // Android NFC scan state
  const [nfcSupported, setNfcSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // NDEFReader is available on Android Chrome (PWA and browser)
    setNfcSupported('NDEFReader' in window);
  }, []);

  // All cards with students
  const { data: cardsData, isLoading: cardsLoading } = useFetch(
    ['nfc-cards', schoolId],
    () => nfcCardService.list(schoolId),
    { enabled: !!schoolId },
  );

  // Assignments
  const { data: assignments = [] } = useFetch(
    ['nfc-assignments', schoolId],
    () => nfcCardService.getAssignments(schoolId),
    { enabled: !!schoolId },
  );

  // NFC Card Status View
  useFetch<NfcCardStatusView[]>(
    ['nfc-status-view', schoolId],
    () => nfcCardService.getCardStatusView(schoolId),
    { enabled: !!schoolId },
  );

  // Cards
  const allCards = (cardsData?.data ?? []) as unknown as CardWithStudent[];
  // Include 'encoded' cards too — they need activation
  const pendingCards = allCards.filter((c) => ['designed', 'printed', 'encoded'].includes(c.status));

  // ── Android Web NFC scan ──────────────────────────────────────────

  async function scanWithNfc() {
    if (!('NDEFReader' in window)) {
      notify.error('NFC scanning is not supported on this device.');
      return;
    }
    setIsScanning(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      notify.success('Hold the NFC card to the back of your phone…');

      ndef.addEventListener('reading', ({ serialNumber }: { serialNumber: string }) => {
        const chipId = serialNumber.replace(/:/g, '').toUpperCase();
        setNfcChipId(chipId);
        setAssignMethod('pwa_scan');
        setIsScanning(false);
        notify.success(`NFC chip detected: ${chipId}`);
      });

      ndef.addEventListener('readingerror', () => {
        notify.error('Could not read NFC chip. Try again.');
        setIsScanning(false);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'NFC scan failed';
      if (msg.includes('permission')) {
        notify.error('NFC permission denied. Enable NFC in your phone settings.');
      } else {
        notify.error(msg);
      }
      setIsScanning(false);
    }
  }

  // ── Encode + Activate NFC ──────────────────────────────────────────

  const encodeNfc = useMutate(
    async () => {
      if (!selectedCard || !nfcChipId.trim()) throw new Error('Missing data');

      // Step 1: Write chip data onto the card record (printed → encoded)
      await nfcCardService.encodeNfc(
        selectedCard.id,
        nfcChipId.trim(),
        { student_id: selectedCard.student_id, card_number: selectedCard.card_number },
        user?.id ?? '',
      );

      // Step 2: Create assignment record + set card status → active
      await nfcCardService.assignCard({
        card_id: selectedCard.id,
        assigned_to_student: selectedCard.student_id,
        assigned_by: user?.id ?? '',
        assignment_method: assignMethod,
      });

      return true;
    },
    [['nfc-cards'], ['nfc-assignments'], ['nfc-status-view']],
    {
      onSuccess: () => {
        notify.success(`Card ${selectedCard?.card_number} encoded and activated.`);
        setSelectedCard(null);
        setNfcChipId('');
        setAssignMethod('manual');
        setIsScanning(false);
      },
    },
  );

  // Activate an already-encoded card (for cards stuck at 'encoded' from old flow)
  const activateCard = useMutate(
    async (card: CardWithStudent) => {
      await nfcCardService.assignCard({
        card_id: card.id,
        assigned_to_student: card.student_id,
        assigned_by: user?.id ?? '',
        assignment_method: 'manual',
      });
      return true;
    },
    [['nfc-cards'], ['nfc-assignments'], ['nfc-status-view']],
    {
      onSuccess: () => notify.success('Card activated successfully.'),
    },
  );

  // Filtered pending cards
  const filteredPending = pendingCards.filter((c) => {
    const s = c.students;
    const matchSearch = !search ||
      `${s?.first_name} ${s?.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      c.card_number.toLowerCase().includes(search.toLowerCase()) ||
      s?.registration_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Stats
  const designedCount = allCards.filter((c) => c.status === 'designed').length;
  const printedCount = allCards.filter((c) => c.status === 'printed').length;
  const encodedCount = allCards.filter((c) => c.status === 'encoded').length;
  const activeCount = allCards.filter((c) => c.status === 'active').length;

  // Pending table columns
  const pendingColumns: Column<CardWithStudent>[] = [
    {
      key: 'card_number', header: 'Card #',
      render: (r) => (
        <div>
          <span className="font-mono text-sm font-medium">{r.card_number}</span>
          <StatusPipeline status={r.status} />
        </div>
      ),
    },
    {
      key: 'student', header: 'Student',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
            {r.students?.photo_url ? (
              <img src={r.students.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              `${r.students?.first_name?.[0] ?? ''}${r.students?.last_name?.[0] ?? ''}`
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{r.students?.first_name} {r.students?.last_name}</p>
            <p className="text-xs text-slate-400 font-mono">{r.students?.registration_number}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'grade', header: 'Grade',
      render: (r) => <span className="text-sm text-slate-600">{r.students?.current_grade_level}</span>,
    },
    {
      key: 'nfc_chip', header: 'NFC Chip',
      render: (r) => r.nfc_chip_id
        ? <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{r.nfc_chip_id}</span>
        : <span className="text-slate-400 text-xs">—</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => {
        const v = r.status === 'printed' ? 'warning' : r.status === 'encoded' ? 'info' : 'default';
        return <Badge variant={v} size="sm">{r.status}</Badge>;
      },
    },
    {
      key: 'actions', header: 'Action',
      render: (r) => {
        if (r.status === 'designed') {
          return (
            <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(r.id, 'printed')}>
              Mark as Printed
            </Button>
          );
        }
        if (r.status === 'printed') {
          return (
            <Button size="sm" onClick={() => { setSelectedCard(r); setNfcChipId(''); setAssignMethod('manual'); }}>
              <ScanLine className="h-3.5 w-3.5 mr-1" /> Encode NFC
            </Button>
          );
        }
        if (r.status === 'encoded') {
          return (
            <Button size="sm" onClick={() => activateCard.mutate(r)} loading={activateCard.isPending}>
              <Zap className="h-3.5 w-3.5 mr-1" /> Activate
            </Button>
          );
        }
        return null;
      },
    },
  ];

  // Assigned table columns — students nested under nfc_cards in the actual data shape
  const assignedList = (assignments as AssignmentRecord[]);
  const assignedColumns: Column<AssignmentRecord>[] = [
    {
      key: 'card', header: 'Card #',
      render: (r) => <span className="font-mono text-sm font-medium">{r.nfc_cards?.card_number}</span>,
    },
    {
      key: 'student', header: 'Student',
      render: (r) => (
        <div>
          <p className="text-sm font-medium">
            {r.nfc_cards?.students?.first_name} {r.nfc_cards?.students?.last_name}
          </p>
          <p className="text-xs text-slate-400 font-mono">{r.nfc_cards?.students?.registration_number}</p>
        </div>
      ),
    },
    {
      key: 'nfc', header: 'NFC Chip',
      render: (r) => r.nfc_cards?.nfc_chip_id
        ? <span className="font-mono text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">{r.nfc_cards.nfc_chip_id}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key: 'method', header: 'Method',
      render: (r) => <Badge variant="info" size="sm">{r.assignment_method.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => {
        const v = r.nfc_cards?.status === 'active' ? 'success' : r.nfc_cards?.status === 'encoded' ? 'warning' : 'default';
        return <Badge variant={v} size="sm">{r.nfc_cards?.status ?? '—'}</Badge>;
      },
    },
    {
      key: 'date', header: 'Assigned',
      render: (r) => <span className="text-sm text-slate-500">{r.assignment_date ? new Date(r.assignment_date).toLocaleDateString() : '—'}</span>,
    },
  ];

  // Status update
  const updateStatus = useMutate(
    async ({ id, status }: { id: string; status: NfcCardStatus }) => {
      await nfcCardService.updateStatus(id, status);
      return true;
    },
    [['nfc-cards']],
  );

  function handleStatusUpdate(cardId: string, status: NfcCardStatus) {
    updateStatus.mutate({ id: cardId, status });
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'NFC Assignment' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <Wifi className="inline-block h-6 w-6 mr-2 text-blue-600" />
          NFC Card Assignment
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Encode NFC chips onto printed student ID cards and activate them.
        </p>
      </div>

      {/* NFC Capability Banner */}
      {nfcSupported ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <Smartphone className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Android NFC scanning available</p>
            <p className="text-xs text-green-600">
              You can scan NFC chips directly with this Android device. Tap "Scan with NFC" in the encode dialog.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">NFC scanning not available on this device</p>
            <p className="text-xs text-amber-600">
              Use an Android phone with Chrome to scan NFC chips. On this device, enter the chip ID manually or use an external USB NFC reader.
            </p>
          </div>
        </div>
      )}

      {/* Status Pipeline Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-slate-400">
          <div className="flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-slate-400" />
            <div>
              <p className="text-2xl font-bold text-slate-600">{designedCount}</p>
              <p className="text-xs text-slate-500">Designed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-400">
          <div className="flex items-center gap-3">
            <Timer className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-600">{printedCount}</p>
              <p className="text-xs text-slate-500">Printed (Awaiting NFC)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-400">
          <div className="flex items-center gap-3">
            <Wifi className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{encodedCount}</p>
              <p className="text-xs text-slate-500">NFC Encoded</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-400">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              <p className="text-xs text-slate-500">Active Cards</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Flow Arrows */}
      <div className="flex items-center justify-center gap-2 py-2">
        {['Designed', 'Printed', 'NFC Encoded', 'Active'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded ${
              i === 0 ? 'bg-slate-100 text-slate-600' :
              i === 1 ? 'bg-amber-100 text-amber-700' :
              i === 2 ? 'bg-blue-100 text-blue-700' :
              'bg-green-100 text-green-700'
            }`}>{label}</span>
            {i < 3 && <ArrowRight className="h-4 w-4 text-slate-300" />}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {([
          { key: 'pending', label: `Pending (${pendingCards.length})`, icon: Timer },
          { key: 'assigned', label: `Active (${assignedList.length})`, icon: CheckCircle2 },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending Tab */}
      {tab === 'pending' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search cards or students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Pending', value: '' },
                { label: 'Designed', value: 'designed' },
                { label: 'Printed', value: 'printed' },
                { label: 'Encoded (needs activation)', value: 'encoded' },
              ]}
            />
          </div>
          {pendingCards.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-600">No pending cards</h3>
              <p className="text-sm text-slate-400 mt-1">All cards are active.</p>
            </Card>
          ) : (
            <Table
              columns={pendingColumns}
              data={filteredPending}
              isLoading={cardsLoading}
              emptyMessage="No matching cards found."
            />
          )}
        </div>
      )}

      {/* Assigned Tab */}
      {tab === 'assigned' && (
        <Table
          columns={assignedColumns}
          data={assignedList}
          isLoading={!assignments}
          emptyMessage="No cards have been activated yet."
        />
      )}

      {/* NFC Encode Dialog */}
      <Dialog open={!!selectedCard} onClose={() => { setSelectedCard(null); setNfcChipId(''); setIsScanning(false); }}>
        <DialogHeader>
          <DialogTitle>Encode & Activate NFC Card</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {selectedCard && (
            <div className="space-y-4">
              {/* Card Info */}
              <Card className="p-4 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                    {selectedCard.students?.first_name?.[0]}{selectedCard.students?.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium">{selectedCard.students?.first_name} {selectedCard.students?.last_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{selectedCard.card_number}</p>
                    <p className="text-xs text-slate-400 font-mono">{selectedCard.students?.registration_number}</p>
                  </div>
                </div>
              </Card>

              {/* Android NFC Scan Button */}
              {nfcSupported && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-2">
                      <Smartphone className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Android NFC Scan</p>
                        <p className="text-xs text-green-600 mt-0.5">
                          {isScanning
                            ? 'Hold the NFC card to the back of your phone…'
                            : 'Tap the button, then hold the physical NFC chip to your phone.'}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={scanWithNfc}
                      loading={isScanning}
                      className="shrink-0"
                    >
                      <Wifi className="h-4 w-4 mr-1" />
                      {isScanning ? 'Scanning…' : 'Scan NFC'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Manual Input */}
              <div>
                <Input
                  label="NFC Chip ID *"
                  value={nfcChipId}
                  onChange={(e) => { setNfcChipId(e.target.value); setAssignMethod('manual'); }}
                  placeholder={nfcSupported ? 'Auto-filled after scan, or type manually' : 'Enter chip ID (e.g., A1B2C3D4)'}
                />
                {nfcChipId && (
                  <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Chip ID ready
                  </p>
                )}
              </div>

              <Select
                label="Assignment Method"
                value={assignMethod}
                onChange={(e) => setAssignMethod(e.target.value as typeof assignMethod)}
                options={[
                  { label: 'Manual Entry', value: 'manual' },
                  { label: 'External USB Reader', value: 'external_reader' },
                  { label: 'PWA Scan (Android)', value: 'pwa_scan' },
                ]}
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <Wifi className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    This will <strong>encode the NFC chip</strong> and immediately <strong>activate the card</strong> for the student.
                    The card status will move to <strong>Active</strong> in one step.
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setSelectedCard(null); setNfcChipId(''); setIsScanning(false); }}>
            Cancel
          </Button>
          <Button
            onClick={() => encodeNfc.mutate(undefined)}
            loading={encodeNfc.isPending}
            disabled={!nfcChipId.trim()}
          >
            <ScanLine className="h-4 w-4 mr-1.5" />
            Encode & Activate
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
