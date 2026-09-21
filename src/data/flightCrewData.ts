export interface CrewMember {
  id: string;
  name: string;
  role: string;
  specialization: string;
  email?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  instagramHandle?: string;
  avatarUrl?: string; // Photo URL
  bio: string;
  callsign?: string;
}

export const INITIAL_FLIGHT_CREW: CrewMember[] = [
  {
    id: 'crew-kidanu',
    name: 'Kidanu Awoke',
    role: 'Project Manager, Aerospace Engineering Student',
    specialization: 'Mission Architecture, Orbital Mechanics & Systems Integration',
    email: 'kidanuawoke44@gmail.com',
    linkedinUrl: 'https://www.linkedin.com/in/kidanu-awoke-55b503351',
    avatarUrl: '/crew/kidanu-awoke.jpg',
    callsign: 'COSMOS-1',
    bio: 'Pioneering first cohort of Aerospace Engineering in Ethiopia. Serving as Project Manager and systems architect leading the SSGI CubeSat Digital Twin development during the capstone internship.',
  },
  {
    id: 'crew-alazar',
    name: 'Alazar Birara',
    role: 'Program Planner, Aerospace Engineering Student, and Power Budget Analyst',
    specialization: 'Electrical Power Systems (EPS), Solar AM0 Array Modeling & Program Planning',
    linkedinUrl: 'https://www.linkedin.com/in/alazar-birara-9b7896350?utm_source=share_via&utm_content=profile&utm_medium=member_android',
    avatarUrl: '/crew/alazar-birara.jpg',
    callsign: 'POWER-2',
    bio: 'Pioneering first cohort Aerospace Engineering student. Program planning, orbital eclipse solar power analysis, Depth-of-Discharge (DoD) optimization, and electrical power subsystem architecture.',
  },
  {
    id: 'crew-eyob',
    name: 'Eyob Lawayew',
    role: 'Atmospheric Drag and Deorbit Analyst, Aerospace Engineering Student',
    specialization: 'Upper-Atmospheric Aeronomy (NRLMSISE-00), B-Star Drag & Orbital Decay Lifetimes',
    email: 'eyoblawayew62@gmail.com',
    avatarUrl: '/crew/eyob-lawayew.jpg',
    callsign: 'DEORBIT-3',
    bio: 'Pioneering first cohort Aerospace Engineering student. Specializing in aerodynamic drag calculations across solar flux cycles, passive deorbit timeline forecasting, and 25-year space debris compliance.',
  },
  {
    id: 'crew-bereket',
    name: 'Bereket Kassaye Oda',
    role: 'Advisor during the Internship, Aerospace Engineer',
    specialization: 'Mentorship, Aerospace Systems Guidance & Internship Advisory',
    email: 'bereket.12223784@lpu.in',
    linkedinUrl: 'https://www.linkedin.com/in/bereket-kassaye/?lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base_contact_details%3BYoyO6yxQRYCP2nOhMbqNsg%3D%3D',
    avatarUrl: '/crew/bereket-kassaye-oda.jpg',
    callsign: 'ADVISOR-4',
    bio: '',
  },
];
