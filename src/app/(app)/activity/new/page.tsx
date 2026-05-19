import { redirect } from 'next/navigation';

export default function NewActivityPage() {
  redirect('/?quickAdd=1');
}
