import { Routes } from '@angular/router';
import { SymptomSearch }       from './symptom-search/symptom-search';
import { AssessmentQuestion }  from './assessment-question/assessment-question';
import { AssessmentResult }    from './assessment-result/assessment-result';
import { AssessmentEmergency } from './assessment-emergency/assessment-emergency';

export const ASSESSMENT_ROUTES: Routes = [
  { path: '',          component: SymptomSearch       },
  { path: 'question',  component: AssessmentQuestion  },
  { path: 'result',    component: AssessmentResult    },
  { path: 'emergency', component: AssessmentEmergency }
];