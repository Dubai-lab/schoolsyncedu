import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { useDebounce } from '@/hooks/useDebounce';
import {
  BookOpen,
  Library,
  Search,
  CalendarDays,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export default function MyLibrary() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'checkouts' | 'catalog'>('checkouts');
  const debouncedSearch = useDebounce(searchTerm, 400);

  const { data: student } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const studentId = student?.id ?? '';

  const { data: checkouts = [], isLoading: loadingCheckouts } = useFetch(
    ['my-checkouts', schoolId, studentId],
    () => studentPortalService.getMyCheckouts(schoolId, studentId),
    { enabled: !!schoolId && !!studentId },
  );

  const { data: books = [], isLoading: loadingBooks } = useFetch(
    ['library-catalog', schoolId, debouncedSearch],
    () => studentPortalService.browseBooks(schoolId, debouncedSearch || undefined),
    { enabled: !!schoolId && tab === 'catalog' },
  );

  const activeCheckouts = checkouts.filter((c: Record<string, unknown>) => !c.return_date);
  const pastCheckouts = checkouts.filter((c: Record<string, unknown>) => !!c.return_date);

  function isOverdue(dueDate: string | undefined) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My Library' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <Library className="inline-block h-6 w-6 mr-2 text-blue-600" />
          My Library
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View your book checkouts and browse the catalog.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab('checkouts')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'checkouts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          My Checkouts ({activeCheckouts.length} active)
        </button>
        <button
          onClick={() => setTab('catalog')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'catalog' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Browse Catalog
        </button>
      </div>

      {tab === 'checkouts' && (
        <>
          {loadingCheckouts ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
            </div>
          ) : activeCheckouts.length === 0 && pastCheckouts.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-600">No checkouts</h3>
              <p className="text-sm text-slate-400 mt-1">You haven't checked out any books. Visit the school library to get started.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Active checkouts */}
              {activeCheckouts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Currently Checked Out</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeCheckouts.map((c: Record<string, unknown>, i: number) => {
                      const book = c.books as Record<string, unknown> | null;
                      const overdue = isOverdue(c.due_date as string | undefined);
                      return (
                        <Card key={i} className={`p-4 ${overdue ? 'border-red-200 bg-red-50/30' : ''}`}>
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-9 bg-slate-200 rounded flex-shrink-0 flex items-center justify-center">
                              <BookOpen className="h-4 w-4 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-slate-800 truncate">
                                {(book?.title as string) || 'Unknown Book'}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {(book?.author as string) || ''}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-xs">
                                <CalendarDays className="h-3 w-3 text-slate-400" />
                                <span className="text-slate-500">
                                  Checked out: {c.checkout_date ? new Date(c.checkout_date as string).toLocaleDateString() : '—'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs">
                                <Clock className="h-3 w-3" />
                                <span className={overdue ? 'text-red-600 font-medium' : 'text-slate-500'}>
                                  Due: {c.due_date ? new Date(c.due_date as string).toLocaleDateString() : '—'}
                                </span>
                                {overdue && (
                                  <Badge variant="danger" size="sm">Overdue</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Past checkouts */}
              {pastCheckouts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Return History</h3>
                  <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="px-4 py-2.5 text-left font-medium text-slate-600">Book</th>
                            <th className="px-4 py-2.5 text-left font-medium text-slate-600">Checked Out</th>
                            <th className="px-4 py-2.5 text-left font-medium text-slate-600">Returned</th>
                            <th className="px-4 py-2.5 text-center font-medium text-slate-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {pastCheckouts.slice(0, 15).map((c: Record<string, unknown>, i: number) => {
                            const book = c.books as Record<string, unknown> | null;
                            return (
                              <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2.5">
                                  <p className="font-medium text-slate-700">{(book?.title as string) || 'Unknown'}</p>
                                </td>
                                <td className="px-4 py-2.5 text-slate-400 text-xs">
                                  {c.checkout_date ? new Date(c.checkout_date as string).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-slate-400 text-xs">
                                  {c.return_date ? new Date(c.return_date as string).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <Badge variant="success" size="sm">
                                    <CheckCircle className="h-3 w-3 mr-0.5" /> Returned
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'catalog' && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search books by title, author, or ISBN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>

          {loadingBooks ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
            </div>
          ) : books.length === 0 ? (
            <Card className="p-10 text-center">
              <Library className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500">{debouncedSearch ? 'No books found matching your search.' : 'No books in the catalog.'}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((b: Record<string, unknown>) => {
                const available = Number(b.available_copies ?? b.copies ?? 0) > 0;
                return (
                  <Card key={b.id as string} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-12 bg-slate-100 rounded flex-shrink-0 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-slate-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 line-clamp-2">{(b.title as string) || 'Untitled'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{(b.author as string) || ''}</p>
                        {b.isbn ? <p className="text-[10px] text-slate-300 font-mono mt-0.5">ISBN: {b.isbn as string}</p> : null}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={available ? 'success' : 'danger'} size="sm">
                            {available ? (
                              <><CheckCircle className="h-3 w-3 mr-0.5" /> Available</>
                            ) : (
                              <><AlertTriangle className="h-3 w-3 mr-0.5" /> Checked Out</>
                            )}
                          </Badge>
                          {b.category ? (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{b.category as string}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
