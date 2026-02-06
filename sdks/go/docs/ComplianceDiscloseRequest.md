# ComplianceDiscloseRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ViewingKey** | [**ViewingKey**](ViewingKey.md) |  | 
**TransactionData** | [**ComplianceDiscloseRequestTransactionData**](ComplianceDiscloseRequestTransactionData.md) |  | 
**Scope** | [**ComplianceDiscloseRequestScope**](ComplianceDiscloseRequestScope.md) |  | 
**AuditorId** | **string** |  | 
**AuditorVerification** | [**ComplianceDiscloseRequestAuditorVerification**](ComplianceDiscloseRequestAuditorVerification.md) |  | 

## Methods

### NewComplianceDiscloseRequest

`func NewComplianceDiscloseRequest(viewingKey ViewingKey, transactionData ComplianceDiscloseRequestTransactionData, scope ComplianceDiscloseRequestScope, auditorId string, auditorVerification ComplianceDiscloseRequestAuditorVerification, ) *ComplianceDiscloseRequest`

NewComplianceDiscloseRequest instantiates a new ComplianceDiscloseRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewComplianceDiscloseRequestWithDefaults

`func NewComplianceDiscloseRequestWithDefaults() *ComplianceDiscloseRequest`

NewComplianceDiscloseRequestWithDefaults instantiates a new ComplianceDiscloseRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetViewingKey

`func (o *ComplianceDiscloseRequest) GetViewingKey() ViewingKey`

GetViewingKey returns the ViewingKey field if non-nil, zero value otherwise.

### GetViewingKeyOk

`func (o *ComplianceDiscloseRequest) GetViewingKeyOk() (*ViewingKey, bool)`

GetViewingKeyOk returns a tuple with the ViewingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKey

`func (o *ComplianceDiscloseRequest) SetViewingKey(v ViewingKey)`

SetViewingKey sets ViewingKey field to given value.


### GetTransactionData

`func (o *ComplianceDiscloseRequest) GetTransactionData() ComplianceDiscloseRequestTransactionData`

GetTransactionData returns the TransactionData field if non-nil, zero value otherwise.

### GetTransactionDataOk

`func (o *ComplianceDiscloseRequest) GetTransactionDataOk() (*ComplianceDiscloseRequestTransactionData, bool)`

GetTransactionDataOk returns a tuple with the TransactionData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTransactionData

`func (o *ComplianceDiscloseRequest) SetTransactionData(v ComplianceDiscloseRequestTransactionData)`

SetTransactionData sets TransactionData field to given value.


### GetScope

`func (o *ComplianceDiscloseRequest) GetScope() ComplianceDiscloseRequestScope`

GetScope returns the Scope field if non-nil, zero value otherwise.

### GetScopeOk

`func (o *ComplianceDiscloseRequest) GetScopeOk() (*ComplianceDiscloseRequestScope, bool)`

GetScopeOk returns a tuple with the Scope field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetScope

`func (o *ComplianceDiscloseRequest) SetScope(v ComplianceDiscloseRequestScope)`

SetScope sets Scope field to given value.


### GetAuditorId

`func (o *ComplianceDiscloseRequest) GetAuditorId() string`

GetAuditorId returns the AuditorId field if non-nil, zero value otherwise.

### GetAuditorIdOk

`func (o *ComplianceDiscloseRequest) GetAuditorIdOk() (*string, bool)`

GetAuditorIdOk returns a tuple with the AuditorId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAuditorId

`func (o *ComplianceDiscloseRequest) SetAuditorId(v string)`

SetAuditorId sets AuditorId field to given value.


### GetAuditorVerification

`func (o *ComplianceDiscloseRequest) GetAuditorVerification() ComplianceDiscloseRequestAuditorVerification`

GetAuditorVerification returns the AuditorVerification field if non-nil, zero value otherwise.

### GetAuditorVerificationOk

`func (o *ComplianceDiscloseRequest) GetAuditorVerificationOk() (*ComplianceDiscloseRequestAuditorVerification, bool)`

GetAuditorVerificationOk returns a tuple with the AuditorVerification field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAuditorVerification

`func (o *ComplianceDiscloseRequest) SetAuditorVerification(v ComplianceDiscloseRequestAuditorVerification)`

SetAuditorVerification sets AuditorVerification field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


