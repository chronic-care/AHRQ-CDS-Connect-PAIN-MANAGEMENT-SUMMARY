import '../helpers/polyfill';
import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import executeElm from '../utils/executeELM';
import sumit from '../helpers/sumit';
import flagit from '../helpers/flagit';
import summaryMap from './summary.json';
import { EHRData, PDMPData } from '../models/fhirResources';
import { CQLSummary } from '../models/cqlSummary';

import Summary from './Summary';
import Spinner from '../elements/Spinner';
import { getEHRData } from '../service/fhirServiceEHR'
import { getPDMPData } from '../service/fhirServicePDMP'
import { executeCQLSummary, getPDMPDispenseSummary } from '../service/cqlServicePDMP'
import executeExternalCDSCall from "../utils/executeExternalCDSHooksCall";
import executeInternalCDSCall from "../utils/executeInternalCDSHooksCall";
import { Hook, Console, Decode } from 'console-feed'
require('es6-promise').polyfill();
require('fetch-everywhere');

let uuid = 0;

function generateUuid() {
    return ++uuid; // eslint-disable-line no-plusplus
}

export default class Landing extends Component<any, any> {
    summaryMapData: any = summaryMap;
    constructor(props: any) {
        super(props);
        this.state = {
            ehrData: null,
            pdmpData: null,
            result: null,
            loading: true,
            collector: [],
            qrCollector: [],
            cdsCollector: [],
            questionText: new Map(),
            logs: []
        };

    }

    componentDidMount() {
        var result;
        executeElm(this.state.collector)
        .then((elmResult) => {
            result = elmResult
        })
        .then(() => {
            return getEHRData();
        })
        .then((ehrData: EHRData) => {
            this.setState({ ehrData: ehrData });
            return getPDMPData(ehrData, 'KY');
        })
        .then((pdmpData: PDMPData) => {
            this.setState({ pdmpData: pdmpData });
            return executeCQLSummary(pdmpData, this.state.ehrData);
        })
        .then((cqlSummary: CQLSummary) => {
            let report = getPDMPDispenseSummary(cqlSummary)
            console.log("PDMP Report = " + JSON.stringify(report))
        //     return report
        // })
        // .then((pdmpResult) => {
            result.Summary["PDMPMedications"] = []
            result.Summary["PDMPMedications"]["PDMPStatus"] = cqlSummary.pdmpStatus;
            result.Summary["PDMPMedications"]["PDMPOpioidMedications"] = report;

            this.setState({ loading: false });
            const { sectionFlags, flaggedCount } = this.processSummary(result.Summary);
            this.setState({ result, sectionFlags, flaggedCount });
            return this.state.collector;
        }, (error) => {
            console.error('Error: ', error);
        })
            .then((collector: any) => {
                if (process.env.REACT_APP_CDS_MODE && process.env.REACT_APP_CDS_MODE.toLowerCase() === 'external') {
                    executeExternalCDSCall(collector)
                        .then((cdsResult: any) => {
                            this.setState({ cdsCollector: cdsResult });
                            return cdsResult;
                        }, (error) => {
                            console.error('Error: ', error);
                        });
                } else if (process.env.REACT_APP_CDS_MODE && process.env.REACT_APP_CDS_MODE.toLowerCase() === 'internal') {
                    executeInternalCDSCall(10, this.state.cdsCollector)
                        .then((cdsResult: any) => {
                            this.setState({ cdsCollector: cdsResult });
                            return cdsResult;
                        }, (error) => {
                            console.error('Error: ', error);
                        });
                }
            })
            .catch((err: any) => {
                console.error('Error: ', err);
            });
        Hook(window.console, log => {
            this.setState(({ logs }) => ({ logs: [...logs, Decode(log)] }))
        })
    }

    componentDidUpdate() {

        if (this.state.result && this.state.result.Summary.Patient.Name) {
            const patientName = this.state.result.Summary.Patient.Name;
            document.title = 'Pain Management Summary - ' + patientName;
        }
    }

    getAnalyticsData(endpoint: any, apikey: any, summary: any) {

        const meetsInclusionCriteria = summary.Patient.MeetsInclusionCriteria;
        const applicationAnalytics: any = {
            meetsInclusionCriteria
        };

        if (meetsInclusionCriteria) {
            let totalCount = 0;
            applicationAnalytics.sections = [];

            const cloneSections = JSON.parse(JSON.stringify(summary));
            delete cloneSections.Patient;

            // Build total number of entries for each subsection of the summary.
            Object.keys(cloneSections).forEach(function (sectionKey, i) {
                applicationAnalytics.sections.push({ section: sectionKey, subSections: [] });
                Object.keys(cloneSections[sectionKey]).forEach(function (subSectionKey) {
                    const subSection = cloneSections[sectionKey][subSectionKey];
                    let count;
                    if (subSection instanceof Array)
                        count = subSection.length;
                    else if (subSection instanceof Object)
                        count = 1;

                    else
                        count = 0;
                    totalCount += count;
                    applicationAnalytics.sections[i].subSections.push({
                        subSection: subSectionKey, numEntries: count
                    });
                });
            });

            applicationAnalytics.totalNumEntries = totalCount;
        }

        let jsonBody = JSON.stringify(applicationAnalytics);

        const requestOptions: any = {
            body: jsonBody,
            headers: {
                'x-api-key': apikey,
                'Content-Type': 'application/json',
                'Content-Length': jsonBody.length
            },
            method: 'POST'
        };

        if (endpoint) {

            // fetch(endpoint, requestOptions)
            //     .catch((err) => {
            //         console.error('Error: ', err);
            //     });
        }

    }

    processSummary(summary: any) {
        const sectionFlags: any = {};
        const sectionKeys: any = Object.keys(this.summaryMapData);
        let flaggedCount = 0;
        sectionKeys.forEach((sectionKey: any, i: any) => {
            sectionFlags[sectionKey] = {};
            this.summaryMapData[sectionKey].forEach((subSection: any) => {
                if (summary[subSection.dataKeySource][subSection.dataKey] && (summary[subSection.dataKeySource][subSection.dataKey].length > 0)) {

                    const data = summary[subSection.dataKeySource][subSection.dataKey];
                    const entries = (Array.isArray(data) ? data : [data]).filter((r) => {
                        // convert sig object to string value
                        if(r['Sig']) {
                            r['Sig'] = r['Sig'].value
                        }
                        return r != null;
                    });
                    if (entries.length > 0) {
                        sectionFlags[sectionKey][subSection.dataKey] = entries.reduce((flaggedEntries: any, entry: any) => {
                            if (entry._id == null) {
                                entry._id = generateUuid();
                            }

                            const entryFlag = flagit(entry, subSection, summary);

                            if (entryFlag) {
                                flaggedEntries.push({ 'entryId': entry._id, 'flagText': entryFlag });
                                flaggedCount += 1;
                            }
                            return flaggedEntries;
                        }, []);
                    } else {
                        const sectionFlagged = flagit(null, subSection, summary);
                        sectionFlags[sectionKey][subSection.dataKey] = sectionFlagged;

                        if (sectionFlagged) {
                            flaggedCount += 1;
                        }
                    }
                }
            }, (error) => {
                console.error('Error: ',error)
            });
        });

        // Get the configured endpoint to use for POST for app analytics
        fetch(process.env.PUBLIC_URL + '/config.json')
            .then((response: any) => {
                return response.json();
            })
            .then((config: any) => {
                // Only provide analytics if the endpoint has been set
                if (config.analytics_endpoint) {
                    this.getAnalyticsData(config.analytics_endpoint, config.x_api_key, summary);
                }
            })
            .catch((err: any) => {
                console.error('Error: ',err)
            });

        return { sectionFlags, flaggedCount };
    }

    render() {
        if (this.state.loading) {
            return <Spinner />;
        }

        if (this.state.result == null) {


            if ((!process.env.NODE_ENV || process.env.NODE_ENV === 'development')) {
                return (
                    <div className="error-page">
                        <div className="banner error">
                            <FontAwesomeIcon icon="exclamation-circle" title="error" /> Error: Please see below.
                        </div>
                        <div style={{ backgroundColor: '#242424', textAlign: 'left' }}>
                            <Console logs={this.state.logs} variant="dark" />
                        </div>
                    </div>
                )
            } else {
                return (
                    <div className="banner error">
                        <FontAwesomeIcon icon="exclamation-circle" title="error" /> Error: See console for details.
                    </div>
                );
            }
        }

        const summary = this.state.result.Summary;
        const { sectionFlags } = this.state;
        const numMedicalHistoryEntries = sumit(summary.PertinentConditions || {});
        const numPainEntries = sumit(summary.PainAssessments || {});
        const numTreatmentsEntries = sumit(summary.HistoricalTreatments || {});
        const numPDMPEntries = sumit(summary.PDMPMedications || {});
        const numRiskEntries =
            sumit(summary.RiskConsiderations || {}) +
            sumit(summary.MiscellaneousItems || {}); // TODO: update when CQL updates
        // const totalEntries = numMedicalHistoryEntries + numPainEntries + numTreatmentsEntries + numRiskEntries;

        return (
            <div className="landing">
                <div id="skiptocontent"><a href="#maincontent">skip to main content</a></div>

                {/* <Header
                    patientName={summary.Patient.Name}
                    patientAge={summary.Patient.Age}
                    patientGender={summary.Patient.Gender}
                    totalEntries={totalEntries}
                    numFlaggedEntries={flaggedCount}
                    meetsInclusionCriteria={summary.Patient.MeetsInclusionCriteria}
                /> */}

                <Summary
                    summary={summary}
                    sectionFlags={sectionFlags}
                    collector={this.state.collector}
                    qrCollector={this.state.qrCollector}
                    result={this.state.result}
                    numMedicalHistoryEntries={numMedicalHistoryEntries}
                    numPainEntries={numPainEntries}
                    numTreatmentsEntries={numTreatmentsEntries}
                    numPDMPEntries={numPDMPEntries}
                    numRiskEntries={numRiskEntries}
                    questionText={this.state.questionText}
                />
            </div>
        );
    }
}
