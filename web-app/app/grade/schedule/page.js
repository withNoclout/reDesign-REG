import ClassSchedule from '../../components/ClassSchedule';

export const metadata = {
    title: 'ตารางเรียน (Class Schedule) - REG KMUTNB',
    description: 'ดูตารางเรียนของคุณ',
};

export default function ClassSchedulePage() {
    return (
        <main className="main-content pt-24 px-4 pb-12 min-h-screen">
            <ClassSchedule />
        </main>
    );
}
