import { redirect } from 'next/navigation'

// The Gracia Tech blueprint lives in one self-contained file so it can be
// embedded anywhere (levels of detail, light/dark, English/Arabic).
export default function GraciaTechBlueprintPage() {
  redirect('/embed/gracia-tech.html')
}
