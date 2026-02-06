# ProofsRangeGenerateRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Value** | **string** | Value to prove (private, not revealed) | 
**Threshold** | **string** | Minimum threshold (public) | 
**BlindingFactor** | **string** | 0x-prefixed 32-byte hex string | 
**Commitment** | Pointer to **string** | Optional existing Pedersen commitment. If omitted, one is created from value + blindingFactor. | [optional] 

## Methods

### NewProofsRangeGenerateRequest

`func NewProofsRangeGenerateRequest(value string, threshold string, blindingFactor string, ) *ProofsRangeGenerateRequest`

NewProofsRangeGenerateRequest instantiates a new ProofsRangeGenerateRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewProofsRangeGenerateRequestWithDefaults

`func NewProofsRangeGenerateRequestWithDefaults() *ProofsRangeGenerateRequest`

NewProofsRangeGenerateRequestWithDefaults instantiates a new ProofsRangeGenerateRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetValue

`func (o *ProofsRangeGenerateRequest) GetValue() string`

GetValue returns the Value field if non-nil, zero value otherwise.

### GetValueOk

`func (o *ProofsRangeGenerateRequest) GetValueOk() (*string, bool)`

GetValueOk returns a tuple with the Value field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetValue

`func (o *ProofsRangeGenerateRequest) SetValue(v string)`

SetValue sets Value field to given value.


### GetThreshold

`func (o *ProofsRangeGenerateRequest) GetThreshold() string`

GetThreshold returns the Threshold field if non-nil, zero value otherwise.

### GetThresholdOk

`func (o *ProofsRangeGenerateRequest) GetThresholdOk() (*string, bool)`

GetThresholdOk returns a tuple with the Threshold field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetThreshold

`func (o *ProofsRangeGenerateRequest) SetThreshold(v string)`

SetThreshold sets Threshold field to given value.


### GetBlindingFactor

`func (o *ProofsRangeGenerateRequest) GetBlindingFactor() string`

GetBlindingFactor returns the BlindingFactor field if non-nil, zero value otherwise.

### GetBlindingFactorOk

`func (o *ProofsRangeGenerateRequest) GetBlindingFactorOk() (*string, bool)`

GetBlindingFactorOk returns a tuple with the BlindingFactor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingFactor

`func (o *ProofsRangeGenerateRequest) SetBlindingFactor(v string)`

SetBlindingFactor sets BlindingFactor field to given value.


### GetCommitment

`func (o *ProofsRangeGenerateRequest) GetCommitment() string`

GetCommitment returns the Commitment field if non-nil, zero value otherwise.

### GetCommitmentOk

`func (o *ProofsRangeGenerateRequest) GetCommitmentOk() (*string, bool)`

GetCommitmentOk returns a tuple with the Commitment field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCommitment

`func (o *ProofsRangeGenerateRequest) SetCommitment(v string)`

SetCommitment sets Commitment field to given value.

### HasCommitment

`func (o *ProofsRangeGenerateRequest) HasCommitment() bool`

HasCommitment returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


