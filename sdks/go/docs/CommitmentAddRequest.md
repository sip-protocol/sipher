# CommitmentAddRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**CommitmentA** | **string** |  | 
**CommitmentB** | **string** |  | 
**BlindingA** | **string** | 0x-prefixed 32-byte hex string | 
**BlindingB** | **string** | 0x-prefixed 32-byte hex string | 

## Methods

### NewCommitmentAddRequest

`func NewCommitmentAddRequest(commitmentA string, commitmentB string, blindingA string, blindingB string, ) *CommitmentAddRequest`

NewCommitmentAddRequest instantiates a new CommitmentAddRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCommitmentAddRequestWithDefaults

`func NewCommitmentAddRequestWithDefaults() *CommitmentAddRequest`

NewCommitmentAddRequestWithDefaults instantiates a new CommitmentAddRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCommitmentA

`func (o *CommitmentAddRequest) GetCommitmentA() string`

GetCommitmentA returns the CommitmentA field if non-nil, zero value otherwise.

### GetCommitmentAOk

`func (o *CommitmentAddRequest) GetCommitmentAOk() (*string, bool)`

GetCommitmentAOk returns a tuple with the CommitmentA field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCommitmentA

`func (o *CommitmentAddRequest) SetCommitmentA(v string)`

SetCommitmentA sets CommitmentA field to given value.


### GetCommitmentB

`func (o *CommitmentAddRequest) GetCommitmentB() string`

GetCommitmentB returns the CommitmentB field if non-nil, zero value otherwise.

### GetCommitmentBOk

`func (o *CommitmentAddRequest) GetCommitmentBOk() (*string, bool)`

GetCommitmentBOk returns a tuple with the CommitmentB field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCommitmentB

`func (o *CommitmentAddRequest) SetCommitmentB(v string)`

SetCommitmentB sets CommitmentB field to given value.


### GetBlindingA

`func (o *CommitmentAddRequest) GetBlindingA() string`

GetBlindingA returns the BlindingA field if non-nil, zero value otherwise.

### GetBlindingAOk

`func (o *CommitmentAddRequest) GetBlindingAOk() (*string, bool)`

GetBlindingAOk returns a tuple with the BlindingA field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingA

`func (o *CommitmentAddRequest) SetBlindingA(v string)`

SetBlindingA sets BlindingA field to given value.


### GetBlindingB

`func (o *CommitmentAddRequest) GetBlindingB() string`

GetBlindingB returns the BlindingB field if non-nil, zero value otherwise.

### GetBlindingBOk

`func (o *CommitmentAddRequest) GetBlindingBOk() (*string, bool)`

GetBlindingBOk returns a tuple with the BlindingB field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBlindingB

`func (o *CommitmentAddRequest) SetBlindingB(v string)`

SetBlindingB sets BlindingB field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


