# CommitmentCreate200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Commitment** | Pointer to **string** | Hex-encoded curve point | [optional] 
**BlindingFactor** | Pointer to **string** |  | [optional] 

## Methods

### NewCommitmentCreate200ResponseData

`func NewCommitmentCreate200ResponseData() *CommitmentCreate200ResponseData`

NewCommitmentCreate200ResponseData instantiates a new CommitmentCreate200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCommitmentCreate200ResponseDataWithDefaults

`func NewCommitmentCreate200ResponseDataWithDefaults() *CommitmentCreate200ResponseData`

NewCommitmentCreate200ResponseDataWithDefaults instantiates a new CommitmentCreate200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCommitment

`func (o *CommitmentCreate200ResponseData) GetCommitment() string`

GetCommitment returns the Commitment field if non-nil, zero value otherwise.

### GetCommitmentOk

`func (o *CommitmentCreate200ResponseData) GetCommitmentOk() (*string, bool)`

GetCommitmentOk returns a tuple with the Commitment field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCommitment

`func (o *CommitmentCreate200ResponseData) SetCommitment(v string)`

SetCommitment sets Commitment field to given value.

### HasCommitment

`func (o *CommitmentCreate200ResponseData) HasCommitment() bool`

HasCommitment returns a boolean if a field has been set.

### GetBlindingFactor

`func (o *CommitmentCreate200ResponseData) GetBlindingFactor() string`

GetBlindingFactor returns the BlindingFactor field if non-nil, zero value otherwise.

### GetBlindingFactorOk

`func (o *CommitmentCreate200ResponseData) GetBlindingFactorOk() (*string, bool)`

GetBlindingFactorOk returns a tuple with the BlindingFactor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingFactor

`func (o *CommitmentCreate200ResponseData) SetBlindingFactor(v string)`

SetBlindingFactor sets BlindingFactor field to given value.

### HasBlindingFactor

`func (o *CommitmentCreate200ResponseData) HasBlindingFactor() bool`

HasBlindingFactor returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


