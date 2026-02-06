# CommitmentCreateBatch200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Results** | Pointer to [**[]CommitmentCreateBatch200ResponseDataResultsInner**](CommitmentCreateBatch200ResponseDataResultsInner.md) |  | [optional] 
**Summary** | Pointer to [**StealthGenerateBatch200ResponseDataSummary**](StealthGenerateBatch200ResponseDataSummary.md) |  | [optional] 

## Methods

### NewCommitmentCreateBatch200ResponseData

`func NewCommitmentCreateBatch200ResponseData() *CommitmentCreateBatch200ResponseData`

NewCommitmentCreateBatch200ResponseData instantiates a new CommitmentCreateBatch200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCommitmentCreateBatch200ResponseDataWithDefaults

`func NewCommitmentCreateBatch200ResponseDataWithDefaults() *CommitmentCreateBatch200ResponseData`

NewCommitmentCreateBatch200ResponseDataWithDefaults instantiates a new CommitmentCreateBatch200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetResults

`func (o *CommitmentCreateBatch200ResponseData) GetResults() []CommitmentCreateBatch200ResponseDataResultsInner`

GetResults returns the Results field if non-nil, zero value otherwise.

### GetResultsOk

`func (o *CommitmentCreateBatch200ResponseData) GetResultsOk() (*[]CommitmentCreateBatch200ResponseDataResultsInner, bool)`

GetResultsOk returns a tuple with the Results field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetResults

`func (o *CommitmentCreateBatch200ResponseData) SetResults(v []CommitmentCreateBatch200ResponseDataResultsInner)`

SetResults sets Results field to given value.

### HasResults

`func (o *CommitmentCreateBatch200ResponseData) HasResults() bool`

HasResults returns a boolean if a field has been set.

### GetSummary

`func (o *CommitmentCreateBatch200ResponseData) GetSummary() StealthGenerateBatch200ResponseDataSummary`

GetSummary returns the Summary field if non-nil, zero value otherwise.

### GetSummaryOk

`func (o *CommitmentCreateBatch200ResponseData) GetSummaryOk() (*StealthGenerateBatch200ResponseDataSummary, bool)`

GetSummaryOk returns a tuple with the Summary field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSummary

`func (o *CommitmentCreateBatch200ResponseData) SetSummary(v StealthGenerateBatch200ResponseDataSummary)`

SetSummary sets Summary field to given value.

### HasSummary

`func (o *CommitmentCreateBatch200ResponseData) HasSummary() bool`

HasSummary returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


