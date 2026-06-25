export const SPECIAL_STUDENT_CODE = '6701091611290';

export const SPECIAL_STUDENT_ACADEMIC_SUMMARY = Object.freeze({
  code: SPECIAL_STUDENT_CODE,
  gpax: '3.92',
  totalCredits: 62,
  semesterCount: 4,
});

export function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeStudentCode(value) {
  const raw = readString(value);
  if (!raw) {
    return null;
  }

  const digitMatch = raw.match(/\d{13}/);
  if (digitMatch) {
    return digitMatch[0];
  }

  const withoutPrefix = raw.replace(/^s/i, '');
  return withoutPrefix || raw;
}

export function getUserCode(user, profile = null) {
  return normalizeStudentCode(
    profile?.studentId
      || profile?.student_id
      || user?.usercode
      || user?.userid
      || user?.username,
  );
}

export function isSpecialStudentCode(value) {
  return normalizeStudentCode(value) === SPECIAL_STUDENT_CODE;
}

export function getDisplayName(user, isGuest, guestName) {
  if (isGuest) {
    return readString(guestName)?.toUpperCase() || 'GUEST';
  }
  return readString(user?.nameeng)?.toUpperCase()
    || readString(user?.usernameeng)?.toUpperCase()
    || readString(user?.name)?.toUpperCase()
    || readString(user?.username)?.toUpperCase()
    || getUserCode(user)
    || 'STUDENT';
}

export function deriveAdmitYear(user, profile) {
  const explicitYear = Number(profile?.admitYear || profile?.admitacadyear || profile?.admit_year);
  if (Number.isFinite(explicitYear) && explicitYear > 2400) {
    return explicitYear;
  }

  const code = getUserCode(user, profile);
  const prefix = code?.match(/^(\d{2})/)?.[1];
  if (!prefix) {
    return null;
  }

  const buddhistYear = 2500 + Number(prefix);
  return Number.isFinite(buddhistYear) ? buddhistYear : null;
}

export function deriveCurrentYear(profile) {
  const explicitYear = Number(profile?.currentYear || profile?.currentacadyear || profile?.enrollYear || profile?.enrollacadyear);
  if (Number.isFinite(explicitYear) && explicitYear > 2400) {
    return explicitYear;
  }
  return new Date().getFullYear() + 543;
}

function readGpaxValue(value) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) {
    return number.toFixed(2);
  }
  const textNumber = Number(readString(value));
  return Number.isFinite(textNumber) && textNumber > 0 ? textNumber.toFixed(2) : null;
}

function readTermNumber(row) {
  const year = Number(row?.acadyear ?? row?.acadYear ?? row?.ACADYEAR ?? row?.year);
  const semester = Number(row?.semester ?? row?.SEMESTER ?? row?.term);
  return {
    year: Number.isFinite(year) ? year : null,
    semester: Number.isFinite(semester) ? semester : null,
  };
}

export function extractLatestGpax(gradeRows) {
  if (!Array.isArray(gradeRows)) {
    return null;
  }

  const gpaxValues = gradeRows
    .map((row, index) => {
      const gpax = readGpaxValue(row?.gpax ?? row?.GPAX ?? row?.cumgpa ?? row?.cumulativeGpa);
      if (!gpax) {
        return null;
      }
      const term = readTermNumber(row);
      return { gpax, index, ...term };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.year !== null && b.year !== null && a.year !== b.year) {
        return a.year - b.year;
      }
      if (a.semester !== null && b.semester !== null && a.semester !== b.semester) {
        return a.semester - b.semester;
      }
      return a.index - b.index;
    });

  return gpaxValues.at(-1)?.gpax || null;
}

export function extractAcademicRecordGpax(academicRecord) {
  return readGpaxValue(academicRecord?.gpax ?? academicRecord?.GPAX ?? academicRecord?.cumgpa ?? academicRecord?.cumulativeGpa);
}

export function getDisplayGpaxForStudent(studentCode, gradeRows, academicRecord = null) {
  if (isSpecialStudentCode(studentCode)) {
    return SPECIAL_STUDENT_ACADEMIC_SUMMARY.gpax;
  }
  return extractAcademicRecordGpax(academicRecord) || extractLatestGpax(gradeRows);
}

export function buildUserMeta(user, profile, gpax, isGuest) {
  if (isGuest) {
    return 'GUEST ACCESS';
  }

  const admitYear = deriveAdmitYear(user, profile);
  const currentYear = deriveCurrentYear(profile);
  const studyYear = admitYear ? Math.max(1, Math.min(8, currentYear - admitYear + 1)) : null;
  const yearLabel = studyYear ? `YEAR ${studyYear}` : (readString(user?.statusdeseng)?.toUpperCase() || 'STUDENT');
  const gpaxLabel = gpax ? `GPAX ${gpax}` : 'GPAX --';

  return `${yearLabel} ${gpaxLabel}`.toUpperCase();
}
