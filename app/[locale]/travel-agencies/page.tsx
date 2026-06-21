import TravelAgenciesClient from './TravelAgenciesClient';

export const metadata = {
    title: 'Співпраця з тревел-агенціями — Touch.Memories',
    robots: { index: false, follow: false }, // non-public until launch
};

export default function TravelAgenciesPage() {
    return <TravelAgenciesClient />;
}
