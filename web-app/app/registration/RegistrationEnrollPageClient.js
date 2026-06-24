import { redirectToMainMenu } from '@/app/redirectToMainMenu';

export default function RegistrationEnrollPageClient({ searchParams }) {
    return redirectToMainMenu('registry', searchParams);
}
