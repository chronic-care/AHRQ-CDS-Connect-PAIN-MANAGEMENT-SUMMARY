import FHIR from 'fhirclient';
import * as formatit from '../helpers/formatit';
export default queryPdmpData;

const rxnorm  = "http://www.nlm.nih.gov/research/umls/rxnorm";
const mmeExtURI = "https://api.crisphealth.org/StructureDefinition/mme";
const drugIdURI = "https://api.crisphealth.org/systems/drugId";
const patientEidURI = "https://api.crisphealth.org/definitions/identifier/eid";

function queryPdmpData(collector) {
  let endpoint, subscriptionKey;
  let pdmpClient, patient;
  let familyName, givenName, birthDate;
  let pdmpData = [];

  // Retrieve the Patient resource stored into collector in previous task.
  collector.forEach(item => {
    if (item.url.startsWith("Patient/")) { patient = item.data; }
  })

  return new Promise((resolve) => {
    const results = fetch(`${process.env.PUBLIC_URL}/config.json`)
    .then(response => response.json())
    .then(config => {
      // Only provide PDMP data if the endpoint has been set in config.json
      if (config.pdmp_endpoint) {
        endpoint = config.pdmp_endpoint;
        pdmpClient = new FHIR.client(endpoint);
        subscriptionKey = config.pdmp_subscription_key;
      }
      else {
        // return an empty array
        resolve(pdmpData)
      }
    })
    .then(() => {
      familyName = pdmpClient.getPath(patient, "name.0.family");
      givenName = pdmpClient.getPath(patient, "name.0.given.0");
      birthDate = pdmpClient.getPath(patient, "birthDate");
    })
    .then(() => {
      var patientSearch = "/Patient?"
        +"family="+familyName +"&given="+givenName +"&birthdate="+birthDate;
      // display(patientSearch)

      // Fetch the PDMP Patient record, if a match exists.
      const requestOptions = {
        flat: true,
        headers: {
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/fhir+json'
        }
      };
      return fetch(endpoint + patientSearch, requestOptions);
    })
    .then((response) => response.json())
    .then((bundle) => {
      if (bundle.entry == null) {
        console.log("No matching PDMP patient.")
        resolve(pdmpData);
      }
      else {
        return bundle.entry;
      }
    })
    .then((entries) => {
      let patientID = entries[0].resource.id;
      return patientID;
    })
    .then((patientID) => {
      // const patientSearch = "subject:Patient.family="+familyName
      //       +"&subject:Patient.given="+givenName
      //       +"&subject:Patient.birthdate=eq"+birthDate;
      // display(patientSearch)

      // return pdmpClient.request("MedicationDispense?" + patientSearch,
      //     { pageLimit: 0, flat: true,
      //       resolveReferences: ["subject", "performer.0.actor"]
      //     })

      var medSearch = "/MedicationDispense?subject=" + patientID;

      const requestOptions = {
        flat: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/fhir+json'
        }
      };
      return fetch(endpoint + medSearch, requestOptions);
    })
    .then((response) => response.json())
    .then((bundle) => {
      if (bundle.entry == null) {
        console.log("No medication dispensations.")
        resolve(pdmpData);
      }
      else {
        return bundle.entry;
      }
    })
    .then((entries) => {
      entries.forEach(entry => {
        let dispense = entry.resource;
        // find contained resources via #id references
        let medId = pdmpClient.getPath(dispense, "medicationReference.reference");
        let medReqId = pdmpClient.getPath(dispense, "authorizingPrescription.0.reference");
        let performerId = pdmpClient.getPath(dispense, "performer.0.actor.reference");
        let locationId = pdmpClient.getPath(dispense, "location.reference");

        let contained = pdmpClient.getPath(dispense, "contained");
        let medication = findContained(contained, medId);
        let medicationRequest = findContained(contained, medReqId);
        let performer = findContained(contained, performerId);
        let location = findContained(contained, locationId);

        var medName = getMedicationName(pdmpClient.getPath(medication, "code.coding"));
        // CRISP workaround until coding is fixed
        if (medName === "NDC" && medication.identifier) {
          let identifiers = pdmpClient.getPath(medication, "identifier")
          let drugId = medication.identifier.find(id => id.system === drugIdURI);
          medName = drugId.value;
        }

        let mmeValue = getExtension(medication, mmeExtURI);
        // console.log("MME = " + mmeValue);

        // let dispenser = getLocationName(location);
        let dispenser = getOrganizationName(performer);

        pdmpData.push({
          "Name": medName,
          "MME": mmeValue,
          "Quantity": pdmpClient.getPath(dispense, "quantity.value"),
          "DaysSupply": pdmpClient.getPath(dispense, "daysSupply.value"),
          "Given": pdmpClient.getPath(dispense, "whenPrepared"),
          "Dispenser": dispenser
        })
      });

      return pdmpData;
    })
    .then((pdmp) => {
      resolve(pdmpData);
    })
    .catch(err => {
      // resolve with an empty array
      resolve(pdmpData);
      console.log(err);
    });
  });
}

function getMedicationName(medCodings = []) {
  var rxnormCoding = medCodings.find(c => c.system === rxnorm);
  var firstCoding = medCodings.find(c => c.display != null);
  return (rxnormCoding && rxnormCoding.display)
          || (firstCoding && firstCoding.display)
          || "Unnamed Medication(TM)";
}

function getOrganizationName(org) {
  return org ? (org.name + ", " + getAddress(org.address[0]))
    : "Unknown Organization"
}

function getLocationName(loc) {
  return loc ? (loc.name + ", " + getAddress(loc.address))
    : "Unknown Location"
}

function getAddress(addr) {
  return addr ? (addr.city + ", " + addr.state) : ""
}

function getExtension(element, extURI) {
  var value;
  if (element && element.extension) {
    element.extension.forEach(ext => {
      if (ext.url === extURI) {
        if (ext.valueString) { value = ext.valueString }
      }
    })
  }
  return value;
}

function isContained(reference) {
  return reference != null && reference.charAt(0) === '#'
}

function findContained(resources = [], id) {
  if (id == null) { return null }

  const token = id.charAt(0) === '#' ? id.slice(1) : id
  return resources.find(r => r.id === token)
}

function display(data) {
    const display = data instanceof Error ?
        String(data) :
        JSON.stringify(data, null, 4);
    console.log(display);
}
