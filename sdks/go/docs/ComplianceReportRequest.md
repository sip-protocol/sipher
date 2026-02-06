# ComplianceReportRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ViewingKey** | [**ViewingKey**](ViewingKey.md) |  | 
**StartTime** | **int32** | Start of reporting window (Unix ms) | 
**EndTime** | **int32** | End of reporting window (Unix ms) | 
**AuditorId** | **string** |  | 
**AuditorVerification** | [**ComplianceDiscloseRequestAuditorVerification**](ComplianceDiscloseRequestAuditorVerification.md) |  | 
**IncludeCounterparties** | Pointer to **bool** |  | [optional] [default to false]

## Methods

### NewComplianceReportRequest

`func NewComplianceReportRequest(viewingKey ViewingKey, startTime int32, endTime int32, auditorId string, auditorVerification ComplianceDiscloseRequestAuditorVerification, ) *ComplianceReportRequest`

NewComplianceReportRequest instantiates a new ComplianceReportRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewComplianceReportRequestWithDefaults

`func NewComplianceReportRequestWithDefaults() *ComplianceReportRequest`

NewComplianceReportRequestWithDefaults instantiates a new ComplianceReportRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetViewingKey

`func (o *ComplianceReportRequest) GetViewingKey() ViewingKey`

GetViewingKey returns the ViewingKey field if non-nil, zero value otherwise.

### GetViewingKeyOk

`func (o *ComplianceReportRequest) GetViewingKeyOk() (*ViewingKey, bool)`

GetViewingKeyOk returns a tuple with the ViewingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKey

`func (o *ComplianceReportRequest) SetViewingKey(v ViewingKey)`

SetViewingKey sets ViewingKey field to given value.


### GetStartTime

`func (o *ComplianceReportRequest) GetStartTime() int32`

GetStartTime returns the StartTime field if non-nil, zero value otherwise.

### GetStartTimeOk

`func (o *ComplianceReportRequest) GetStartTimeOk() (*int32, bool)`

GetStartTimeOk returns a tuple with the StartTime field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStartTime

`func (o *ComplianceReportRequest) SetStartTime(v int32)`

SetStartTime sets StartTime field to given value.


### GetEndTime

`func (o *ComplianceReportRequest) GetEndTime() int32`

GetEndTime returns the EndTime field if non-nil, zero value otherwise.

### GetEndTimeOk

`func (o *ComplianceReportRequest) GetEndTimeOk() (*int32, bool)`

GetEndTimeOk returns a tuple with the EndTime field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEndTime

`func (o *ComplianceReportRequest) SetEndTime(v int32)`

SetEndTime sets EndTime field to given value.


### GetAuditorId

`func (o *ComplianceReportRequest) GetAuditorId() string`

GetAuditorId returns the AuditorId field if non-nil, zero value otherwise.

### GetAuditorIdOk

`func (o *ComplianceReportRequest) GetAuditorIdOk() (*string, bool)`

GetAuditorIdOk returns a tuple with the AuditorId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAuditorId

`func (o *ComplianceReportRequest) SetAuditorId(v string)`

SetAuditorId sets AuditorId field to given value.


### GetAuditorVerification

`func (o *ComplianceReportRequest) GetAuditorVerification() ComplianceDiscloseRequestAuditorVerification`

GetAuditorVerification returns the AuditorVerification field if non-nil, zero value otherwise.

### GetAuditorVerificationOk

`func (o *ComplianceReportRequest) GetAuditorVerificationOk() (*ComplianceDiscloseRequestAuditorVerification, bool)`

GetAuditorVerificationOk returns a tuple with the AuditorVerification field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAuditorVerification

`func (o *ComplianceReportRequest) SetAuditorVerification(v ComplianceDiscloseRequestAuditorVerification)`

SetAuditorVerification sets AuditorVerification field to given value.


### GetIncludeCounterparties

`func (o *ComplianceReportRequest) GetIncludeCounterparties() bool`

GetIncludeCounterparties returns the IncludeCounterparties field if non-nil, zero value otherwise.

### GetIncludeCounterpartiesOk

`func (o *ComplianceReportRequest) GetIncludeCounterpartiesOk() (*bool, bool)`

GetIncludeCounterpartiesOk returns a tuple with the IncludeCounterparties field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIncludeCounterparties

`func (o *ComplianceReportRequest) SetIncludeCounterparties(v bool)`

SetIncludeCounterparties sets IncludeCounterparties field to given value.

### HasIncludeCounterparties

`func (o *ComplianceReportRequest) HasIncludeCounterparties() bool`

HasIncludeCounterparties returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


