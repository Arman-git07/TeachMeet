
'use client';
import { createContext, useContext, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Role } from '@/lib/roles';
import type { Classroom } from '@/app/dashboard/classrooms/[classroomId]/page';

interface ClassroomContextType {
    classroomId: string;
    classroom: Classroom | null;
    user: User | null;
    userRole: Role;
}

const ClassroomContext = createContext<ClassroomContextType | undefined>(undefined);

export const ClassroomProvider = ({ children, value }: { children: ReactNode; value: ClassroomContextType }) => {
    return <ClassroomContext.Provider value={value}>{children}</ClassroomContext.Provider>;
};

export const useClassroom = (): ClassroomContextType => {
    const context = useContext(ClassroomContext);
    if (context === undefined) {
        throw new Error('useClassroom must be used within a ClassroomProvider');
    }
    return context;
};
