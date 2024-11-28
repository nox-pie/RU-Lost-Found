export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  year: string;
  school: string;
  enrollmentNumber: string;
}

export interface Item {
  id: string;
  type: 'lost' | 'found';
  title: string;
  description: string;
  location: string;
  date: string;
  reporter: string;
  reporterId: string;
  status: 'open' | 'claimed';
  createdAt: number;
  image: string;
}

export type School = 
  | 'Newton School of Technology'
  | 'School of Entrepreneurship'
  | 'School of Psychology & Education'
  | 'School of Creativity'
  | 'School of Healthcare'
  | 'School of Public Leadership';