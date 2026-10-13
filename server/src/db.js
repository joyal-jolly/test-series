import { supabase } from './supabase.js';

// -----------------------------------------------------------------------------
// Unified Supabase Database Operations
// -----------------------------------------------------------------------------

export const dbService = {
  // USERS
  async getUserById(id) {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  async getUserByEmail(email) {
    const normalized = email.trim().toLowerCase();
    const { data, error } = await supabase.from('users').select('*').eq('email', normalized).maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  async getUsers(role) {
    let query = supabase.from('users').select('*');
    if (role) query = query.eq('role', role);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createUser(user) {
    const { error } = await supabase.from('users').insert(user);
    if (error) throw new Error(error.message);
    return user;
  },

  async updateUserStatus(id, status) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ status, updatedAt: now })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  // SUBJECTS
  async getSubjects() {
    const { data, error } = await supabase.from('subjects').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },

  // QUESTION PAPERS
  async getQuestionPapers() {
    const { data, error } = await supabase.from('question_papers').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getQuestionPaperById(id) {
    const { data, error } = await supabase.from('question_papers').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  async createQuestionPaper(paper) {
    const { error } = await supabase.from('question_papers').insert(paper);
    if (error) throw new Error(error.message);
    return paper;
  },

  async updateQuestionPaper(id, updates) {
    const now = new Date().toISOString();
    const payload = { ...updates, updatedAt: now };
    const { data, error } = await supabase
      .from('question_papers')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  async deleteQuestionPaper(id) {
    const { error } = await supabase.from('question_papers').delete().eq('id', id);
    if (error) throw new Error(error.message);
    // Also cascade-delete related attempts and submissions
    const { data: attempts } = await supabase.from('attempts').select('id').eq('questionPaperId', id);
    if (attempts?.length) {
      const attemptIds = attempts.map((a) => a.id);
      await supabase.from('submissions').delete().in('attemptId', attemptIds);
      await supabase.from('attempts').delete().eq('questionPaperId', id);
    }
    await supabase.from('submissions').delete().eq('questionPaperId', id);
    return true;
  },

  // ATTEMPTS
  async getAttempts() {
    const { data, error } = await supabase.from('attempts').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAttemptById(id) {
    const { data, error } = await supabase.from('attempts').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  async createAttempt(attempt) {
    const { error } = await supabase.from('attempts').insert(attempt);
    if (error) throw new Error(error.message);
    return attempt;
  },

  async updateAttempt(id, updates) {
    const now = new Date().toISOString();
    const payload = { ...updates, updatedAt: now };
    const { data, error } = await supabase
      .from('attempts')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  async deleteAttempt(id) {
    const { error } = await supabase.from('attempts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  // SUBMISSIONS
  async getSubmissions() {
    const { data, error } = await supabase.from('submissions').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getSubmissionById(id) {
    const { data, error } = await supabase.from('submissions').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  async createSubmission(submission, attemptId) {
    const now = new Date().toISOString();
    const [subRes, attRes] = await Promise.all([
      supabase.from('submissions').insert(submission),
      supabase.from('attempts').update({ status: 'submitted', submittedAt: now, updatedAt: now }).eq('id', attemptId),
    ]);
    if (subRes.error) throw new Error(subRes.error.message);
    if (attRes.error) throw new Error(attRes.error.message);
    return submission;
  },

  async updateSubmission(id, updates) {
    const { data, error } = await supabase
      .from('submissions')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  async assignReviewer(submissionIds, reviewerId) {
    const now = new Date().toISOString();
    const assignedIds = [];

    for (const sid of submissionIds) {
      const { data: sub } = await supabase.from('submissions').select('*').eq('id', sid).maybeSingle();
      if (!sub || !['submitted', 'assigned'].includes(sub.status)) continue;

      await Promise.all([
        supabase.from('submissions').update({
          assignedReviewerId: reviewerId,
          assignedAt: now,
          status: 'assigned',
        }).eq('id', sid),
        supabase.from('attempts').update({
          status: 'assigned',
          updatedAt: now,
        }).eq('id', sub.attemptId),
      ]);
      assignedIds.push(sid);
    }

    return assignedIds;
  },

  // EVALUATIONS
  async getEvaluations() {
    const { data, error } = await supabase.from('evaluations').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getQuestionEvaluations(evaluationId) {
    let query = supabase.from('question_evaluations').select('*');
    if (evaluationId) query = query.eq('evaluationId', evaluationId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async submitEvaluation({ evaluation, questionEvaluations, submissionId, attemptId }) {
    // 1. Remove any prior incomplete or duplicate evaluation for this submission
    const { data: existingEvals } = await supabase
      .from('evaluations')
      .select('id')
      .eq('submissionId', submissionId);

    if (existingEvals && existingEvals.length > 0) {
      const existingIds = existingEvals.map((e) => e.id);
      await supabase.from('question_evaluations').delete().in('evaluationId', existingIds);
      await supabase.from('evaluations').delete().in('id', existingIds);
    }

    // 2. Insert parent evaluation FIRST so foreign key constraint is satisfied
    const evRes = await supabase.from('evaluations').insert(evaluation);
    if (evRes.error) throw new Error(evRes.error.message);

    // 3. Insert child question evaluations AFTER parent exists in database
    if (questionEvaluations && questionEvaluations.length > 0) {
      const qeRes = await supabase.from('question_evaluations').insert(questionEvaluations);
      if (qeRes.error) throw new Error(qeRes.error.message);
    }

    // 4. Update submission status and attempt status
    const now = new Date().toISOString();
    const [subRes, attRes] = await Promise.all([
      supabase.from('submissions').update({ status: 'evaluated' }).eq('id', submissionId),
      supabase.from('attempts').update({ status: 'evaluated', updatedAt: now }).eq('id', attemptId),
    ]);
    if (subRes.error) throw new Error(subRes.error.message);
    if (attRes.error) throw new Error(attRes.error.message);

    return { evaluation, questionEvaluations };
  },


  // CONTACT MESSAGES
  async createContactMessage(entry) {
    const { error } = await supabase.from('contact_messages').insert(entry);
    if (error) throw new Error(error.message);
    return entry;
  },
};
