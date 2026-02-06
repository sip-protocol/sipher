# CommitmentVerifyRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Commitment** | **string** |  | 
**Value** | **string** |  | 
**BlindingFactor** | **string** | 0x-prefixed 32-byte hex string | 

## Methods

### NewCommitmentVerifyRequest

`func NewCommitmentVerifyRequest(commitment string, value string, blindingFactor string, ) *CommitmentVerifyRequest`

NewCommitmentVerifyRequest instantiates a new CommitmentVerifyRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCommitmentVerifyRequestWithDefaults

`func NewCommitmentVerifyRequestWithDefaults() *CommitmentVerifyRequest`

NewCommitmentVerifyRequestWithDefaults instantiates a new CommitmentVerifyRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCommitment

`func (o *CommitmentVerifyRequest) GetCommitment() string`

GetCommitment returns the Commitment field if non-nil, zero value otherwise.

### GetCommitmentOk

`func (o *CommitmentVerifyRequest) GetCommitmentOk() (*string, bool)`

GetCommitmentOk returns a tuple with the Commitment field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCommitment

`func (o *CommitmentVerifyRequest) SetCommitment(v string)`

SetCommitment sets Commitment field to given value.


### GetValue

`func (o *CommitmentVerifyRequest) GetValue() string`

GetValue returns the Value field if non-nil, zero value otherwise.

### GetValueOk

`func (o *CommitmentVerifyRequest) GetValueOk() (*string, bool)`

GetValueOk returns a tuple with the Value field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetValue

`func (o *CommitmentVerifyRequest) SetValue(v string)`

SetValue sets Value field to given value.


### GetBlindingFactor

`func (o *CommitmentVerifyRequest) GetBlindingFactor() string`

GetBlindingFactor returns the BlindingFactor field if non-nil, zero value otherwise.

### GetBlindingFactorOk

`func (o *CommitmentVerifyRequest) GetBlindingFactorOk() (*string, bool)`

GetBlindingFactorOk returns a tuple with the BlindingFactor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingFactor

`func (o *CommitmentVerifyRequest) SetBlindingFactor(v string)`

SetBlindingFactor sets BlindingFactor field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


