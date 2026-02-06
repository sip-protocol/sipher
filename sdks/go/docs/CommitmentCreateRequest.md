# CommitmentCreateRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Value** | **string** | Non-negative integer string | 
**BlindingFactor** | Pointer to **string** | Optional custom blinding factor | [optional] 

## Methods

### NewCommitmentCreateRequest

`func NewCommitmentCreateRequest(value string, ) *CommitmentCreateRequest`

NewCommitmentCreateRequest instantiates a new CommitmentCreateRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCommitmentCreateRequestWithDefaults

`func NewCommitmentCreateRequestWithDefaults() *CommitmentCreateRequest`

NewCommitmentCreateRequestWithDefaults instantiates a new CommitmentCreateRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetValue

`func (o *CommitmentCreateRequest) GetValue() string`

GetValue returns the Value field if non-nil, zero value otherwise.

### GetValueOk

`func (o *CommitmentCreateRequest) GetValueOk() (*string, bool)`

GetValueOk returns a tuple with the Value field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetValue

`func (o *CommitmentCreateRequest) SetValue(v string)`

SetValue sets Value field to given value.


### GetBlindingFactor

`func (o *CommitmentCreateRequest) GetBlindingFactor() string`

GetBlindingFactor returns the BlindingFactor field if non-nil, zero value otherwise.

### GetBlindingFactorOk

`func (o *CommitmentCreateRequest) GetBlindingFactorOk() (*string, bool)`

GetBlindingFactorOk returns a tuple with the BlindingFactor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingFactor

`func (o *CommitmentCreateRequest) SetBlindingFactor(v string)`

SetBlindingFactor sets BlindingFactor field to given value.

### HasBlindingFactor

`func (o *CommitmentCreateRequest) HasBlindingFactor() bool`

HasBlindingFactor returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


