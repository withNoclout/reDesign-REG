import { isSpecialStudentCode, normalizeStudentCode } from './studentPortalSummary.mjs';

const SPECIAL_LOCKED_TERM_IDS = new Set(['2568/1', '2567/2', '2567/1']);

export const SPECIAL_STUDENT_ACADEMIC_RECORD = Object.freeze({
  gpax: '3.92',
  totalCredits: 62,
  semesters: [
    {
      id: '2568/2',
      year: '2568',
      semester: '2',
      gpa: '-',
      credits: 18,
      subjects: [
        { code: '010913121', name: 'MAINTENANCE ENGINEERING', credit: 3, grade: '' },
        { code: '010913132', name: 'AUTOMATION SYSTEM', credit: 3, grade: '' },
        { code: '040203213', name: 'NUMERICAL METHOD', credit: 3, grade: '' },
        { code: '040433001', name: 'INTRO TO FOOD ENTREPRENEURSHIP', credit: 3, grade: '' },
        { code: '040503011', name: 'STAT FOR ENGR & SCIENTISTS', credit: 3, grade: '' },
        { code: '080103002', name: 'ENGLISH II', credit: 3, grade: '' },
      ],
    },
    {
      id: '2568/1',
      year: '2568',
      semester: '1',
      gpa: '3.85',
      credits: 21,
      subjects: [
        { code: '010013121', name: 'ENGINEERING MECHANICS', credit: 3, grade: 'A' },
        { code: '010113851', name: 'BASIC ELECTRICAL ENGINEERING', credit: 3, grade: 'B+' },
        { code: '010113852', name: 'BASIC ELECTRICAL LABORATORY', credit: 1, grade: 'A' },
        { code: '010213410', name: 'MANUFACTURING PROCESSES', credit: 3, grade: 'B+' },
        { code: '010913123', name: 'COMPUTER-AIDED DESIGN', credit: 3, grade: 'A' },
        { code: '030103200', name: 'MACHINE TOOLS PRACTICE', credit: 2, grade: 'A' },
        { code: '040203210', name: 'LINEAR ALGEB & DIF EQUA FOR ENG', credit: 3, grade: 'A' },
        { code: '080103001', name: 'ENGLISH I', credit: 3, grade: 'A' },
      ],
    },
    {
      id: '2567/2',
      year: '2567',
      semester: '2',
      gpa: '3.97',
      credits: 20,
      subjects: [
        { code: '010013402', name: 'ENGINEERING THERMODYNAMICS', credit: 3, grade: 'A' },
        { code: '010213525', name: 'ENGINEERING MATERIALS', credit: 3, grade: 'A' },
        { code: '040203100', name: 'GENERAL MATHEMATICS', credit: 3, grade: 'A' },
        { code: '040203112', name: 'ENGINEERING MATHEMATICS II', credit: 3, grade: 'A' },
        { code: '040313007', name: 'PHYSICS II', credit: 3, grade: 'A' },
        { code: '040313008', name: 'PHYSICS LAB II', credit: 1, grade: 'A' },
        { code: '080303501', name: 'BASKETBALL', credit: 1, grade: 'A' },
        { code: '080303601', name: 'HUMAN RELATIONS', credit: 3, grade: 'B+' },
      ],
    },
    {
      id: '2567/1',
      year: '2567',
      semester: '1',
      gpa: '4.00',
      credits: 21,
      subjects: [
        { code: '010013016', name: 'ENGINEERING DRAWING', credit: 3, grade: 'A' },
        { code: '010913701', name: 'COMPUTER PROGRAMMING', credit: 3, grade: 'A' },
        { code: '040113001', name: 'CHEMISTRY FOR ENGINEERS', credit: 3, grade: 'A' },
        { code: '040113002', name: 'CHEMISTRY LAB FOR ENGR', credit: 1, grade: 'A' },
        { code: '040203111', name: 'ENGINEERING MATHEMATICS I', credit: 3, grade: 'A' },
        { code: '040313005', name: 'PHYSICS I', credit: 3, grade: 'A' },
        { code: '040313006', name: 'PHYSICS LAB I', credit: 1, grade: 'A' },
        { code: '080303503', name: 'BADMINTON', credit: 1, grade: 'A' },
        { code: '080303701', name: 'DESIGN THINKING', credit: 3, grade: 'A' },
      ],
    },
  ],
});

function sortSemestersDescending(semesters) {
  return [...semesters].sort((a, b) => {
    if (Number(b.year) !== Number(a.year)) return Number(b.year) - Number(a.year);
    return Number(b.semester) - Number(a.semester);
  });
}

function normalizeCourseCode(value) {
  return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

function isSemesterSummary(row) {
  const name = String(row?.coursename || row?.courseName || row?.subject || '').trim().toUpperCase();
  return name.includes('SEMESTER TOTAL');
}

function readNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function transformFlatGradeRows(flatRows) {
  const grouped = new Map();
  const semesterSummaries = {};
  let latestGpax = '0.00';
  let totalCredits = 0;

  for (const item of Array.isArray(flatRows) ? flatRows : []) {
    const acadyear = String(item?.acadyear || item?.acadYear || item?.year || '').trim();
    const semester = String(item?.semester || item?.term || '').trim();
    if (!acadyear || !semester) continue;

    const key = `${acadyear}/${semester}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        year: acadyear,
        semester,
        gpa: '0.00',
        credits: 0,
        subjects: [],
      });
    }

    const term = grouped.get(key);
    if (isSemesterSummary(item)) {
      const normalizedGpa = readNumber(item?.gpa).toFixed(2);
      const normalizedCredits = readNumber(item?.creditsatisfy || item?.credits || item?.credit);
      const summary = {
        id: key,
        gpa: normalizedGpa,
        credits: normalizedCredits,
        gradePoints: readNumber(item?.gradepoint),
        gpax: readNumber(item?.gpax),
        cumulativeCredits: readNumber(item?.sumcreditsatisfy),
      };

      term.gpa = normalizedGpa;
      term.credits = normalizedCredits;
      semesterSummaries[key] = summary;

      if (summary.gpax > 0) {
        latestGpax = summary.gpax.toFixed(2);
        totalCredits = summary.cumulativeCredits;
      }
      continue;
    }

    const code = normalizeCourseCode(item?.coursecode || item?.courseCode || item?.subject_id || item?.code);
    const name = normalizeCourseCode(item?.coursename || item?.courseName || item?.subject_name_en || item?.subject_name_th || item?.name);
    if (!code && !name) continue;

    term.subjects.push({
      code,
      name,
      credit: item?.creditattempt ?? item?.credithours ?? item?.credit ?? item?.courseunit ?? '',
      grade: item?.grade ?? item?.GRADE ?? '',
    });
  }

  const semesters = sortSemestersDescending(Array.from(grouped.values()));
  if (semesters.length > 0) {
    const latestSummary = semesterSummaries[semesters[0].id];
    if (latestSummary) {
      latestGpax = latestSummary.gpax.toFixed(2);
      totalCredits = latestSummary.cumulativeCredits;
    }
  }

  return {
    gpax: latestGpax,
    totalCredits,
    semesters,
    semesterSummaries,
  };
}

export function mergeSpecialAcademicRecord(liveRecord) {
  if (!liveRecord) return SPECIAL_STUDENT_ACADEMIC_RECORD;

  const liveSemesterMap = new Map(liveRecord.semesters.map((term) => [term.id, term]));
  const mergedSemesters = SPECIAL_STUDENT_ACADEMIC_RECORD.semesters.map((term) => {
    const liveTerm = liveSemesterMap.get(term.id);
    if (!liveTerm || SPECIAL_LOCKED_TERM_IDS.has(term.id)) return term;

    const liveSubjectMap = new Map(liveTerm.subjects.map((subject) => [subject.code, subject]));
    const mergedSubjects = term.subjects.map((subject) => {
      const liveSubject = liveSubjectMap.get(subject.code);
      if (!liveSubject) return subject;
      return {
        ...subject,
        credit: subject.credit ?? liveSubject.credit,
        grade: subject.grade || liveSubject.grade || '',
      };
    });

    const extraLiveSubjects = liveTerm.subjects.filter((subject) => !term.subjects.some((existing) => existing.code === subject.code));
    return {
      ...term,
      gpa: term.gpa && term.gpa !== '-' ? term.gpa : liveTerm.gpa,
      credits: term.credits || liveTerm.credits,
      subjects: [...mergedSubjects, ...extraLiveSubjects],
    };
  });

  const extraLiveSemesters = liveRecord.semesters.filter((term) => !SPECIAL_STUDENT_ACADEMIC_RECORD.semesters.some((existing) => existing.id === term.id));
  const baseCredits = Number(SPECIAL_STUDENT_ACADEMIC_RECORD.totalCredits || 0);
  const baseGpax = Number(SPECIAL_STUDENT_ACADEMIC_RECORD.gpax || 0);
  const liveDynamicSummaries = Object.values(liveRecord.semesterSummaries || {}).filter((summary) => !SPECIAL_LOCKED_TERM_IDS.has(summary.id));
  const addedCredits = liveDynamicSummaries.reduce((sum, summary) => sum + Number(summary.credits || 0), 0);
  const addedGradePoints = liveDynamicSummaries.reduce((sum, summary) => sum + Number(summary.gradePoints || 0), 0);
  const mergedTotalCredits = addedCredits > 0 ? baseCredits + addedCredits : SPECIAL_STUDENT_ACADEMIC_RECORD.totalCredits;
  const mergedGpax = addedCredits > 0
    ? ((baseGpax * baseCredits) + addedGradePoints) / mergedTotalCredits
    : baseGpax;

  return {
    gpax: Number.isFinite(mergedGpax) ? mergedGpax.toFixed(2) : SPECIAL_STUDENT_ACADEMIC_RECORD.gpax,
    totalCredits: mergedTotalCredits,
    semesters: sortSemestersDescending([...mergedSemesters, ...extraLiveSemesters]),
  };
}

export function buildAcademicRecordForStudent(studentCode, liveRows) {
  const liveRecord = transformFlatGradeRows(liveRows);
  if (isSpecialStudentCode(normalizeStudentCode(studentCode))) {
    return mergeSpecialAcademicRecord(liveRecord);
  }
  return liveRecord;
}
