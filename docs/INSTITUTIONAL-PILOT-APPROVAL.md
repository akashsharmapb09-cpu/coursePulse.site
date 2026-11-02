# CoursePulse Institutional Pilot Approval and Data-Use Record

<escape>**Status: PENDING — NOT APPROVED**</escape>  
**Project:** CoursePulse `.site`  
**Public URL:** https://coursepulse-site.vercel.app  
**Supabase region:** `us-east-1` (United States)  
**Prepared:** 2 November 2026

This is a review and signature template, not legal advice, a binding agreement or evidence that a college has approved CoursePulse. No assistant, developer or platform operator can sign on behalf of the institution. The institution's authorized officers must complete this document and approve the public privacy, terms and student-facing notices before real student data is entered.

## A. Institution and accountable parties

| Field | Institution to complete |
|---|---|
| Legal name of institution | [Required] |
| Registered address / jurisdiction | [Required] |
| Pilot campus / department | [Required] |
| Pilot sponsor and role | [Required] |
| Data controller / institutional owner | [Required] |
| Platform operator / processor (legal identity) | [Required] |
| Data protection / privacy contact | [Required] |
| IT/security contact | [Required] |
| Student support contact | [Required] |
| Incident-notification contact and procedure | [Required] |

## B. Proposed pilot scope

| Field | Institution to complete |
|---|---|
| Pilot start and end dates | [Required] |
| Courses and departments in scope | [Required] |
| Named instructors | [Required] |
| Expected student count | [Required] |
| Student age range; minors included? | [Required] |
| Approved student groups / eligibility rule | [Required] |
| Purpose of feedback and permitted uses | [Required] |
| Whether participation is voluntary | [Required] |
| Alternative route for students who do not participate | [Required] |

The pilot must not be used for grading, discipline, employment decisions or other purposes not expressly approved by the institution and disclosed to students.

## C. Data and privacy review

The institution must review and approve each item below:

- **Account data:** institutional email, display name, assigned role and active/suspended state.
- **Academic data:** departments, semester, courses, instructor assignments and course enrollments.
- **Feedback data:** submitted question answers, including any free-text response if free-text questions are enabled.
- **Eligibility data:** a separate private record used to determine whether a student may submit once. The application stores new answer payloads separately from this eligibility record.
- **Reporting:** instructors/admins use aggregate reporting; groups below five responses are suppressed. This threshold reduces small-cohort disclosure but is not a guarantee of anonymity. Repeated-query, timing, complementary-group and contextual re-identification risks need institutional review.
- **Legacy data:** the older `responses` table includes a student identifier with the answer row. It had zero rows at the latest review; do not migrate/import historic identifiable responses without a separate review and approval.
- **Retention:** the current feedback-form default is 365 days; the application permits 30–730 days per form and a scheduled cleanup removes expired response records. The institution must choose and document a purpose-based retention schedule.
- **Deletion:** the app records deletion requests. The institution's authorized Supabase owner must carry out and verify Auth-user deletion; the app does not automatically delete Auth identities.
- **Hosting location:** the current Supabase project database is in `us-east-1` (United States). The college must assess and explicitly accept or reject this location and its contractual/legal implications.
- **Vendors:** review Supabase and Vercel's current terms, data processing terms, subprocessors, backup/retention settings and incident processes before approval.

Institutional decisions:

| Decision | Approved value / explanation | Reviewer |
|---|---|---|
| Lawful basis / authority for processing | [Required] | [Required] |
| Student notice and consent wording, where needed | [Required] | [Required] |
| Minor/student-under-18 handling | [Required] | [Required] |
| Free-text questions allowed? | [Yes/No + safeguards] | [Required] |
| Retention period by feedback form | [Required] | [Required] |
| Data-subject access/correction/deletion process | [Required] | [Required] |
| Whether US hosting is acceptable | [Accept/Reject + rationale] | [Required] |
| Anonymity limitations communicated to students | [Required] | [Required] |
| Incident reporting and response time | [Required] | [Required] |
| End-of-pilot export, deletion and closure | [Required] | [Required] |

## D. Public notice and service terms review

The current `/privacy`, `/terms` and `/cookies` pages are technical drafts/implementation guidance, not institution-approved legal notices. Before use, the institution must approve the actual wording and complete the institution identity, controller/operator, contact, jurisdiction, lawful basis, student/minor handling, retention, support, complaint and governing-law fields. No institution logo, certification, legal claim or approval statement may be published without authorization.

## E. Technical and operational acceptance

The institution's IT/security reviewer should record evidence for:

- [ ] Supabase Site URL and exact redirect allow-list reviewed and tested.
- [ ] Signup confirmation and password-reset flow tested.
- [ ] Admin TOTP MFA (AAL2) and recovery process tested.
- [ ] Student/instructor/admin role and object-scope checks tested.
- [ ] No synthetic student responses exist in the live college database.
- [ ] Production vs. preview database separation decision documented (they currently share one Supabase project).
- [ ] Incident escalation, support contacts and account suspension procedure documented.
- [ ] Backup/restore capability and recovery expectations documented.
- [ ] Accessibility review and student-facing alternatives reviewed.
- [ ] Pilot shutdown, export and deletion procedure accepted.

Known technical limitations that require explicit acceptance or remediation: leaked-password protection is reported disabled on the current Free plan; full real-browser role tests, accessibility and backup/restore evidence are not complete; a READY deployment and passing automated tests are not institution acceptance.

## F. Approval decision

Select one:

- [ ] Approved for a supervised synthetic-data demonstration only.
- [ ] Approved for a limited real-student pilot under the scope and controls above.
- [ ] Not approved; remediation or further review is required.

Any approval is limited to the named institution, courses, cohort, dates and purposes recorded above. Expansion requires a new review.

## G. Required signatures

| Approver | Name and title | Decision / conditions | Signature | Date |
|---|---|---|---|---|
| Principal / Dean / authorized institution head | [Required] | [Required] | [Required] | [Required] |
| Department head / pilot sponsor | [Required] | [Required] | [Required] | [Required] |
| IT / Information Security | [Required] | [Required] | [Required] | [Required] |
| Legal / Data Protection / Compliance | [Required] | [Required] | [Required] | [Required] |
| CoursePulse service operator | [Required] | [Required] | [Required] | [Required] |

**No signatures are recorded in this template. Until the institution's authorized approvers complete this section and approve the notices, the institutional approval status remains NOT APPROVED and real student data must not be entered.**
