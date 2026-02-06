# CommitmentCreateBatch200ResponseDataResultsInner

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Index** | Pointer to **int32** |  | [optional] 
**Success** | Pointer to **bool** |  | [optional] 
**Data** | Pointer to [**CommitmentAdd200ResponseData**](CommitmentAdd200ResponseData.md) |  | [optional] 
**Error** | Pointer to **string** |  | [optional] 

## Methods

### NewCommitmentCreateBatch200ResponseDataResultsInner

`func NewCommitmentCreateBatch200ResponseDataResultsInner() *CommitmentCreateBatch200ResponseDataResultsInner`

NewCommitmentCreateBatch200ResponseDataResultsInner instantiates a new CommitmentCreateBatch200ResponseDataResultsInner object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCommitmentCreateBatch200ResponseDataResultsInnerWithDefaults

`func NewCommitmentCreateBatch200ResponseDataResultsInnerWithDefaults() *CommitmentCreateBatch200ResponseDataResultsInner`

NewCommitmentCreateBatch200ResponseDataResultsInnerWithDefaults instantiates a new CommitmentCreateBatch200ResponseDataResultsInner object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetIndex

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) GetIndex() int32`

GetIndex returns the Index field if non-nil, zero value otherwise.

### GetIndexOk

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) GetIndexOk() (*int32, bool)`

GetIndexOk returns a tuple with the Index field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIndex

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) SetIndex(v int32)`

SetIndex sets Index field to given value.

### HasIndex

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) HasIndex() bool`

HasIndex returns a boolean if a field has been set.

### GetSuccess

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) GetSuccess() bool`

GetSuccess returns the Success field if non-nil, zero value otherwise.

### GetSuccessOk

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) GetSuccessOk() (*bool, bool)`

GetSuccessOk returns a tuple with the Success field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSuccess

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) SetSuccess(v bool)`

SetSuccess sets Success field to given value.

### HasSuccess

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) HasSuccess() bool`

HasSuccess returns a boolean if a field has been set.

### GetData

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) GetData() CommitmentAdd200ResponseData`

GetData returns the Data field if non-nil, zero value otherwise.

### GetDataOk

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) GetDataOk() (*CommitmentAdd200ResponseData, bool)`

GetDataOk returns a tuple with the Data field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetData

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) SetData(v CommitmentAdd200ResponseData)`

SetData sets Data field to given value.

### HasData

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) HasData() bool`

HasData returns a boolean if a field has been set.

### GetError

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) GetError() string`

GetError returns the Error field if non-nil, zero value otherwise.

### GetErrorOk

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) GetErrorOk() (*string, bool)`

GetErrorOk returns a tuple with the Error field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetError

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) SetError(v string)`

SetError sets Error field to given value.

### HasError

`func (o *CommitmentCreateBatch200ResponseDataResultsInner) HasError() bool`

HasError returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


