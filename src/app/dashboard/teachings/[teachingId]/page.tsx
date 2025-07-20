
// This file has been replaced by src/app/dashboard/classrooms/[classroomId]/page.tsx
// to reflect the new data model and feature name.
// This file can be deleted.

import { redirect } from 'next/navigation';

export default function DeprecatedTeachingDetailsPage({ params }: { params: { teachingId: string } }) {
    redirect(`/dashboard/classrooms/${params.teachingId}`);
}
