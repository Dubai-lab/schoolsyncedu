import { supabase } from '@/lib/supabase';
import type { UUID, ISODate, BookCondition } from '@/types/common.types';
import type {
  Book,
  BookCopy,
  BookCheckout,
  BookReturn,
  LibraryOutstandingItem,
  BookFilterParams,
} from '@/types/library.types';

// ==================== BOOK CATALOG ====================

export const bookService = {
  async list(
    schoolId: UUID,
    params: BookFilterParams & { page?: number; pageSize?: number } = {},
  ) {
    const { page = 1, pageSize = 25, category, search, available } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('books')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('title')
      .range(from, to);

    if (category) query = query.eq('category', category);
    if (available) query = query.gt('available_copies', 0);
    if (search) query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as Book[], count: count ?? 0 };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase.from('books').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Book;
  },

  async create(schoolId: UUID, entry: {
    title: string; author?: string; isbn?: string; category?: string;
    description?: string; publisher?: string; publication_year?: number; total_copies: number;
  }) {
    const { data, error } = await supabase
      .from('books')
      .insert({
        school_id: schoolId,
        ...entry,
        available_copies: entry.total_copies,
      })
      .select()
      .single();
    if (error) throw error;

    // Create the physical copies. Without this the counters above were
    // fiction: the catalog showed "500 / 500" while checkout found no copies
    // at all, because book_copies was never populated. generate_book_copies
    // assigns each one a serial number and the trigger corrects the counters.
    if (entry.total_copies > 0) {
      const { error: copyError } = await supabase.rpc('generate_book_copies', {
        p_book_id: (data as Book).id,
        p_count: entry.total_copies,
      });
      if (copyError) throw copyError;
    }

    return data as Book;
  },

  /** Add more physical copies to an existing book. */
  async addCopies(bookId: UUID, count: number) {
    const { data, error } = await supabase.rpc('generate_book_copies', {
      p_book_id: bookId,
      p_count: count,
    });
    if (error) throw error;
    return data as number;
  },

  async update(id: UUID, entry: Partial<{
    title: string; author: string; isbn: string; category: string;
    description: string; publisher: string; publication_year: number; total_copies: number;
  }>) {
    const { data, error } = await supabase
      .from('books')
      .update({ ...entry, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Book;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) throw error;
  },

  async getCategories(schoolId: UUID) {
    const { data, error } = await supabase
      .from('books')
      .select('category')
      .eq('school_id', schoolId)
      .not('category', 'is', null);
    if (error) throw error;
    const unique = [...new Set((data ?? []).map((d) => d.category as string))].sort();
    return unique;
  },
};

// ==================== BOOK COPIES ====================

export const bookCopyService = {
  async listByBook(bookId: UUID) {
    const { data, error } = await supabase
      .from('book_copies')
      .select('*')
      .eq('book_id', bookId)
      .order('barcode');
    if (error) throw error;
    return data as BookCopy[];
  },

  async create(bookId: UUID, barcode: string) {
    const { data, error } = await supabase
      .from('book_copies')
      .insert({ book_id: bookId, barcode, status: 'available' })
      .select()
      .single();
    if (error) throw error;
    return data as BookCopy;
  },

  async updateStatus(id: UUID, status: string) {
    const { data, error } = await supabase
      .from('book_copies')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as BookCopy;
  },
};

// ==================== CHECKOUTS ====================

export const checkoutService = {
  async list(
    schoolId: UUID,
    params: { page?: number; pageSize?: number; isReturned?: boolean; studentId?: UUID } = {},
  ) {
    const { page = 1, pageSize = 25, isReturned, studentId } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('book_checkouts')
      .select(
        `*, book_copies!inner(id, barcode, book_id, books!inner(id, title, author, school_id)), students!inner(id, first_name, last_name, registration_number)`,
        { count: 'exact' },
      )
      .eq('book_copies.books.school_id', schoolId)
      .order('checkout_date', { ascending: false })
      .range(from, to);

    if (isReturned !== undefined) query = query.eq('is_returned', isReturned);
    if (studentId) query = query.eq('student_id', studentId);

    const { data, count, error } = await query;
    if (error) throw error;
    return {
      data: data as (BookCheckout & { book_copies: Record<string, unknown>; students: Record<string, unknown> })[],
      count: count ?? 0,
    };
  },

  async checkout(entry: {
    student_id: UUID; book_copy_id: UUID; due_date: ISODate; checked_out_by: UUID;
  }) {
    // Insert checkout record
    const { data, error } = await supabase
      .from('book_checkouts')
      .insert({
        ...entry,
        checkout_date: new Date().toISOString().split('T')[0],
        is_returned: false,
      })
      .select()
      .single();
    if (error) throw error;

    // Update copy status
    // Checked, like every other write here. An unnoticed failure would leave
    // the copy reading 'available' while a student holds it, and the next
    // borrower would be handed a book that is already out.
    const { error: copyOutError } = await supabase
      .from('book_copies')
      .update({ status: 'checked_out' })
      .eq('id', entry.book_copy_id);
    if (copyOutError) throw copyOutError;

    return data as BookCheckout;
  },

  async returnBook(entry: {
    book_copy_id: UUID; student_id: UUID; condition: BookCondition; checked_in_by: UUID;
  }) {
    // Insert return record
    const { data: returnData, error: returnError } = await supabase
      .from('book_returns')
      .insert({
        book_copy_id: entry.book_copy_id,
        student_id: entry.student_id,
        return_date: new Date().toISOString().split('T')[0],
        condition: entry.condition,
        checked_in_by: entry.checked_in_by,
      })
      .select()
      .single();
    if (returnError) throw returnError;

    // Mark checkout as returned.
    //
    // return_date matters as much as is_returned: the student portal decides
    // what is still on loan with `!return_date`, so setting only the boolean
    // left every returned book on their screen forever, eventually shown as
    // overdue. See migration 213.
    // The result is checked. This call had no error handling at all, and there
    // was no UPDATE policy on book_checkouts for it to satisfy — so it matched
    // zero rows every time and said nothing, leaving the loan open while the
    // book sat back on the shelf. See migration 223.
    const { data: closed, error: closeError } = await supabase
      .from('book_checkouts')
      .update({ is_returned: true, return_date: new Date().toISOString().split('T')[0] })
      .eq('book_copy_id', entry.book_copy_id)
      .eq('student_id', entry.student_id)
      .eq('is_returned', false)
      .select('id');

    if (closeError) throw closeError;

    // Zero rows is not success. Either the loan was already closed or the
    // write was refused; both need saying rather than reporting a return that
    // did not happen.
    if (!closed || closed.length === 0) {
      throw new Error(
        'The return was recorded but the loan could not be closed. Refresh and check the student still has this copy on loan.',
      );
    }

    // Update copy status based on condition
    const copyStatus = entry.condition === 'damaged' ? 'damaged' : 'available';
    const { error: copyInError } = await supabase
      .from('book_copies')
      .update({ status: copyStatus })
      .eq('id', entry.book_copy_id);
    if (copyInError) throw copyInError;

    return returnData as BookReturn;
  },
};

// ==================== OVERDUE / REPORTS ====================

export const libraryReportService = {
  async getOutstandingItems(_schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_library_outstanding_items')
      .select('*');
    if (error) throw error;
    // View doesn't have school_id filter built-in, but data is joined from school-scoped books
    return data as LibraryOutstandingItem[];
  },

  async getOverdueBooks() {
    const { data, error } = await supabase
      .from('overdue_books')
      .select('*')
      .order('days_overdue', { ascending: false });
    if (error) throw error;
    return data as { id: string; student_id: string; book_copy_id: string; due_date: string; days_overdue: number; fine_amount: number; status: string; checkout_id: string }[];
  },

  async getTodayActivity(_schoolId: UUID) {
    const today = new Date().toISOString().split('T')[0];
    const [checkoutsRes, returnsRes] = await Promise.all([
      supabase
        .from('book_checkouts')
        .select('id', { count: 'exact', head: true })
        .eq('checkout_date', today),
      supabase
        .from('book_returns')
        .select('id', { count: 'exact', head: true })
        .eq('return_date', today),
    ]);
    return {
      checkoutsToday: checkoutsRes.count ?? 0,
      returnsToday: returnsRes.count ?? 0,
    };
  },

  async getStats(schoolId: UUID) {
    const [booksResult, checkoutsResult] = await Promise.all([
      supabase.from('books').select('total_copies, available_copies').eq('school_id', schoolId),
      supabase.from('book_checkouts').select('id', { count: 'exact' }).eq('is_returned', false),
    ]);
    if (booksResult.error) throw booksResult.error;

    const books = booksResult.data ?? [];
    const totalBooks = books.reduce((sum, b) => sum + (b.total_copies ?? 0), 0);
    const availableBooks = books.reduce((sum, b) => sum + (b.available_copies ?? 0), 0);
    const activeCheckouts = checkoutsResult.count ?? 0;

    return {
      totalTitles: books.length,
      totalBooks,
      availableBooks,
      checkedOut: totalBooks - availableBooks,
      activeCheckouts,
    };
  },
};
