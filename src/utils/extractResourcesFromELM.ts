function extractResourcesFromELM(elm, isFromOpiodRec) {
  const resources: any = new Set();
  if (elm && elm.source && elm.source.library && elm.source.library.statements && elm.source.library.statements.def) {
    let expDef: any;
    for (expDef of Object.values(elm.source.library.statements.def)) {
      extractResourcesFromExpression(resources, expDef.expression!);
    }
  }
  if(isFromOpiodRec){
    resources.add('MedicationRequest');
  }
  resources.add('Questionnaire');
  return Array.from(resources);
}

function extractResourcesFromExpression(resources, expression) {
  if (expression && Array.isArray(expression)) {
    expression.forEach(e => extractResourcesFromExpression(resources, e));
  } else if (expression && typeof expression === 'object') {
    if (expression.type === 'Retrieve') {
      const match = /^(\{http:\/\/hl7.org\/fhir\})?([A-Z][a-zA-Z]+)$/.exec(expression.dataType);
      if (match) {
        resources.add(match[2]);
      } else {
        console.error('Cannot find resource for Retrieve w/ dataType: ', expression.dataType);
      }
    } else {
      for (const val of Object.values(expression)) {
        extractResourcesFromExpression(resources, val);
      }
    }
  }
}

export default extractResourcesFromELM;
