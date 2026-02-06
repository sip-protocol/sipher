# BackendsCompareRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Operation** | **string** | Type of privacy operation to compare backends for | 
**Chain** | Pointer to **string** | Target blockchain (default: solana) | [optional] 
**Amount** | Pointer to **string** | Transaction amount in smallest units | [optional] 
**Prioritize** | Pointer to **string** | Factor to prioritize in scoring (adjusts weights to 60%) | [optional] 

## Methods

### NewBackendsCompareRequest

`func NewBackendsCompareRequest(operation string, ) *BackendsCompareRequest`

NewBackendsCompareRequest instantiates a new BackendsCompareRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBackendsCompareRequestWithDefaults

`func NewBackendsCompareRequestWithDefaults() *BackendsCompareRequest`

NewBackendsCompareRequestWithDefaults instantiates a new BackendsCompareRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetOperation

`func (o *BackendsCompareRequest) GetOperation() string`

GetOperation returns the Operation field if non-nil, zero value otherwise.

### GetOperationOk

`func (o *BackendsCompareRequest) GetOperationOk() (*string, bool)`

GetOperationOk returns a tuple with the Operation field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOperation

`func (o *BackendsCompareRequest) SetOperation(v string)`

SetOperation sets Operation field to given value.


### GetChain

`func (o *BackendsCompareRequest) GetChain() string`

GetChain returns the Chain field if non-nil, zero value otherwise.

### GetChainOk

`func (o *BackendsCompareRequest) GetChainOk() (*string, bool)`

GetChainOk returns a tuple with the Chain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChain

`func (o *BackendsCompareRequest) SetChain(v string)`

SetChain sets Chain field to given value.

### HasChain

`func (o *BackendsCompareRequest) HasChain() bool`

HasChain returns a boolean if a field has been set.

### GetAmount

`func (o *BackendsCompareRequest) GetAmount() string`

GetAmount returns the Amount field if non-nil, zero value otherwise.

### GetAmountOk

`func (o *BackendsCompareRequest) GetAmountOk() (*string, bool)`

GetAmountOk returns a tuple with the Amount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAmount

`func (o *BackendsCompareRequest) SetAmount(v string)`

SetAmount sets Amount field to given value.

### HasAmount

`func (o *BackendsCompareRequest) HasAmount() bool`

HasAmount returns a boolean if a field has been set.

### GetPrioritize

`func (o *BackendsCompareRequest) GetPrioritize() string`

GetPrioritize returns the Prioritize field if non-nil, zero value otherwise.

### GetPrioritizeOk

`func (o *BackendsCompareRequest) GetPrioritizeOk() (*string, bool)`

GetPrioritizeOk returns a tuple with the Prioritize field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrioritize

`func (o *BackendsCompareRequest) SetPrioritize(v string)`

SetPrioritize sets Prioritize field to given value.

### HasPrioritize

`func (o *BackendsCompareRequest) HasPrioritize() bool`

HasPrioritize returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


